"""Prepare for free; atomically persist a successful pair and finalize the trial.

PostgreSQL transaction advisory locks serialize one guest through generation.
No application callback can spend a trial. Cancellation/error rolls back the
transaction; a repeated accepted client ID returns its stored completion.
"""
import json
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from backend.models.guest_trial import GuestTrial
from backend.core.account.guest_identity import resolve_guest_fingerprint
from backend.core.account.subject import resolve_account_subject
from backend.core.account.quota_events import CHAT_MESSAGE, DISCOVER_CONVERSATION_STARTED
from backend.core.account.usage_service import _acquire_subject_quota_lock, count_usage_events, record_account_usage_event
from backend.core.schemas.mirror_sohbet import MirrorSohbetSessionResponse


def deny(reason, status=403):
    return HTTPException(status, detail={"reason": reason, "currentTier": "guest", "upgradeRequired": reason.endswith("limit_reached")})

async def lock_guest(db, fingerprint):
    # Shared key for session preparation and every generation endpoint.
    await _acquire_subject_quota_lock(db, user_id=None, guest_fingerprint=fingerprint, event_type="guest_trial")

async def find_trial(db, fingerprint):
    return (await db.execute(select(GuestTrial).where(GuestTrial.guest_fingerprint == fingerprint))).scalar_one_or_none()

async def legacy_used(db, fingerprint):
    # Historical starts cannot be proven unused: preserve the denial rather than
    # silently granting another trial. Reconciliation requires audited evidence.
    return await count_usage_events(db, event_types=(DISCOVER_CONVERSATION_STARTED,), user_id=None, guest_fingerprint=fingerprint, since=None)


def session_response(row, token, resumed=False):
    payload = dict(row.session_payload)
    payload.update(guestToken=token, guestTrialSessionId=row.session_id,
                   guestTrialResumed=resumed or bool(row.started_at), guestTrialMessages=[
        message for turn in row.turns for message in (
            {"id": turn["userId"], "text": turn["query"], "isUser": True},
            {"id": turn["assistantId"], "text": turn["answer"], "isUser": False})])
    return MirrorSohbetSessionResponse.model_validate(payload)

async def prepare_guest_trial(db, slug, token, replay_selection):
    fingerprint = resolve_guest_fingerprint(token)
    if not fingerprint: raise deny("guest_token_required")
    await lock_guest(db, fingerprint)
    row = await find_trial(db, fingerprint)
    if row and row.started_at:
        if row.source_slug != slug: raise deny("guest_discover_limit_reached")
        from backend.services.mirror_network.service import fetch_public_mirror_by_slug
        from backend.services.mirror_network.frozen_journey_artifact import get_public_frozen_journey_artifact
        await fetch_public_mirror_by_slug(db, slug)
        if await get_public_frozen_journey_artifact(db, slug=slug) is None: raise deny("guest_trial_source_unavailable", 404)
        return session_response(row, token)
    if await legacy_used(db, fingerprint): raise deny("guest_discover_limit_reached")
    if row and row.source_slug == slug:
        return session_response(row, token, resumed=True)
    from backend.services.mirror_network.sohbet_session import create_sohbet_session
    session = await create_sohbet_session(db, slug, token, replay_selection=replay_selection, defer_commit=True)
    payload = session.model_dump(mode="json"); payload.pop("guestToken", None)
    if row is None:
        row = GuestTrial(guest_fingerprint=fingerprint, session_id=session.sessionId,
                         source_slug=slug, session_payload=payload, turns=[])
        db.add(row)
    else:
        # Abandoned preparations are free and replaceable; old session IDs cease
        # to authorize generation once another source is prepared.
        row.session_id=session.sessionId; row.source_slug=slug; row.session_payload=payload
    await db.flush()
    return session_response(row, token)

async def begin_guest_turn(db, request, credentials, token):
    if not request.guestTrialSessionId:
        if request.publicReplaySelection is not None:
            subject = await resolve_account_subject(db, credentials=credentials, guest_token=token)
            if not subject.is_authenticated: raise deny("guest_trial_session_invalid")
        return None
    subject = await resolve_account_subject(db, credentials=credentials, guest_token=token)
    if subject.is_authenticated: return None
    fp = subject.guest_fingerprint
    if not fp: raise deny("guest_token_required")
    await lock_guest(db, fp)
    row = await find_trial(db, fp)
    if not row or row.session_id != request.guestTrialSessionId:
        raise deny("guest_trial_session_invalid")
    if not request.clientUserMessageId or not request.clientAssistantMessageId:
        raise deny("guest_trial_message_id_required", 422)
    text=request.query_value.strip()
    for turn in row.turns:
        if turn["userId"] == request.clientUserMessageId:
            if turn["query"] != text or turn["assistantId"] != request.clientAssistantMessageId:
                raise deny("guest_trial_message_conflict", 409)
            return row, turn
        if turn["assistantId"] == request.clientAssistantMessageId:
            raise deny("guest_trial_message_conflict", 409)
    if not text or len(text)>500: raise deny("message_too_long")
    used=await count_usage_events(db, event_types=(CHAT_MESSAGE,), user_id=None, guest_fingerprint=fp, since=None)
    if used>=10 or len(row.turns)>=10: raise deny("guest_message_limit_reached")
    return row, None

async def finish_guest_turn(db, row, request, answer, result):
    if not answer.strip(): raise deny("guest_trial_empty_answer", 502)
    # Caller holds the guest lock from begin through this single commit.
    # Optional pipeline telemetry must not receive this session: its own commit
    # would release the transaction lock before acceptance.
    turn={"userId": request.clientUserMessageId, "assistantId": request.clientAssistantMessageId,
          "query": request.query_value.strip(), "answer": answer, "result": result}
    row.turns=[*row.turns,turn]
    if row.started_at is None:
        row.started_at=datetime.now(timezone.utc)
        await record_account_usage_event(db,event_type=DISCOVER_CONVERSATION_STARTED,
            guest_fingerprint=row.guest_fingerprint,source_id="guest-trial:"+row.session_id,
            metadata={"mirrorSlug":row.source_slug,"lifecycle":"accepted"})
    await record_account_usage_event(db,event_type=CHAT_MESSAGE,
        guest_fingerprint=row.guest_fingerprint,source_id="guest-turn:"+row.session_id+":"+request.clientUserMessageId)
    await db.flush()
    await db.commit()

async def guest_history(db, row, request):
    from backend.core.schemas.mirror_sohbet import PublicReplaySelection
    from backend.services.mirror_network.public_replay_continuation import resolve_generation_replay_history
    context=row.session_payload.get("publicReplayContext")
    canonical=PublicReplaySelection.model_validate({k:context[k] for k in ("slug","journeyVersion","completedStepCount")}) if context else None
    # Source and previous private turns are server-owned, never client-authorized.
    personal=[{"role":role,"content":turn[key]} for turn in row.turns for role,key in (("user","query"),("assistant","answer"))]
    from backend.core.schemas.pipeline import ChatHistoryMessage
    bound=request.model_copy(update={"publicReplaySelection":canonical,"history":[ChatHistoryMessage(**m) for m in personal[-12:]]})
    history = await resolve_generation_replay_history(db,bound,None)
    from backend.services.business_yansi.publication import enabled
    if canonical is None and enabled():
        from backend.models.mirror_network import MirrorNetworkNode
        from sqlalchemy import select
        from backend.services.business_yansi.answers import bind_business_history
        node=await db.scalar(select(MirrorNetworkNode).where(MirrorNetworkNode.slug==row.source_slug))
        if node: return await bind_business_history(db,row.source_slug,node.journey_version,history,request.query_value)
    return history

async def record_trial_continuation(db, row, token):
    proof = row.session_payload.get("lineageProofToken")
    if not proof or not token or len(row.turns) != 1: return
    from backend.services.mirror_network.yansi_own_continuation import record_own_continuation_started_best_effort
    await record_own_continuation_started_best_effort(db,lineage_proof_token=proof,
        history=None,guest_token=token,credentials=None)

async def guest_stream(db,row,request,history,token=None):
    from backend.api.streaming import stream_standalone_response
    tokens=[];completed=False
    try:
        async for frame in stream_standalone_response(query=request.query_value,safe_only=request.safe_only or False,
                db_session=None,analysis_model=request.model,chat_history=history):
            data=json.loads(frame.removeprefix("data: ").strip())
            if data.get("token"): tokens.append(data["token"])
            if data.get("done"):
                answer="".join(tokens)
                stored={**data,"assistant_answer":answer}
                await finish_guest_turn(db,row,request,answer,stored)
                completed=True
                await record_trial_continuation(db,row,token)
            yield frame
    finally:
        if not completed: await db.rollback()
