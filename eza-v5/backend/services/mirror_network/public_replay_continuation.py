"""Canonical public replay context, separate from personal persisted messages."""
from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.schemas.mirror_sohbet import PublicReplaySelection
from backend.services.mirror_network.service import fetch_public_mirror_by_slug
from backend.services.mirror_network.frozen_journey_artifact import get_public_frozen_journey_artifact

REPLAY_METADATA_KEY = "publicReplaySelection"
MAX_PUBLIC_REPLAY_CONTEXT_CHARS = 64_000


async def resolve_public_replay_context(db, selection: PublicReplaySelection) -> dict:
    # This service performs the same current visibility/safety gate as public GET.
    await fetch_public_mirror_by_slug(db, selection.slug)
    frozen = await get_public_frozen_journey_artifact(
        db, slug=selection.slug, journey_version=selection.journeyVersion,
    )
    if not frozen or frozen.get("journeyVersion") != selection.journeyVersion:
        raise HTTPException(404, detail={"code": "public_replay_unavailable"})
    steps = frozen.get("steps", [])
    if selection.completedStepCount > len(steps) or any(
        step.get("stepIndex") != index + 1 for index, step in enumerate(steps)
    ):
        raise HTTPException(422, detail={"code": "public_replay_invalid_prefix"})
    prefix = steps[:selection.completedStepCount]
    if sum(len(step["publicQuestion"]) + len(step["publicAnswer"]) for step in prefix) > MAX_PUBLIC_REPLAY_CONTEXT_CHARS:
        raise HTTPException(413, detail={"code": "public_replay_context_too_large"})
    return {
        **selection.model_dump(),
        "publicTitle": frozen.get("publicTitle") or "",
        "authorUserId": frozen["authorUserId"],
        "steps": [{"stepIndex": step["stepIndex"], "publicQuestion": step["publicQuestion"],
                   "publicAnswer": step["publicAnswer"]} for step in prefix],
    }


async def resolve_generation_replay_history(db, request, persistence):
    from backend.api.standalone_chat_memory import PublicReplayHistory
    from backend.services.standalone.conversations import _get_owned_conversation, StandaloneConversationNotFoundError

    selection = request.publicReplaySelection
    if persistence is not None:
        try:
            conv = await _get_owned_conversation(
                db, user_id=persistence.user_id, conversation_id=persistence.conversation_id,
            )
        except StandaloneConversationNotFoundError as exc:
            raise HTTPException(404, detail={"code": "conversation_not_found"}) from exc
        if conv.archived_at is not None:
            raise HTTPException(404, detail={"code": "conversation_not_found"})
        stored = (conv.tree_metadata or {}).get(REPLAY_METADATA_KEY)
        if stored:
            try:
                canonical = PublicReplaySelection.model_validate(stored)
            except ValidationError as exc:
                raise HTTPException(422, detail={"code": "public_replay_invalid_selection"}) from exc
            if selection and selection != canonical:
                raise HTTPException(409, detail={"code": "public_replay_selection_mismatch"})
            selection = canonical
        elif selection:
            # Authenticated continuations must bind their source at conversation creation.
            raise HTTPException(409, detail={"code": "public_replay_not_bound"})
    history = [{"role": h.role, "content": h.content} for h in request.history or []]
    if selection is None:
        return history or None
    context = await resolve_public_replay_context(db, selection)
    public_messages = []
    for step in context["steps"]:
        public_messages.extend([
            {"role": "user", "content": step["publicQuestion"]},
            {"role": "assistant", "content": step["publicAnswer"]},
        ])
    return PublicReplayHistory(public_messages, history)
