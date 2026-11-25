"""V2 conversation-draft adapter for existing Business Cover AI image proposals.

Reuses reserve/settle, preview store, and brand-asset confirm from
`cover_image_suggestions` / `cover_ai`. Does not create a second budget system.
Does not send raw knowledge documents to the image provider — only title,
curiosity, summary, Q/A turns, and optional visual direction.
"""
from __future__ import annotations

from sqlalchemy import select

from backend.services.business_yansi.cover_ai import (
    CoverAiProviderError,
    enabled,
    quote_for,
    reconcile_proposal,
    run_proposal,
)
from backend.services.business_yansi.cover_ai_preview_store import (
    cleanup_expired_previews,
    preview_expired,
    read_preview_bytes,
)
from backend.services.business_yansi.cover_image_suggestions import (
    MAX_ANSWER,
    MAX_PROMPT_CHARS,
    MAX_QA_ITEMS,
    MAX_QUESTION,
    MAX_SUMMARY,
    MAX_TITLE,
    DraftSnapshot,
    ImageGenerationProvider,
    _clip,
    _payload_identity,
    build_image_prompt,
    content_fingerprint,
    present_image_suggestion,
)

PROMPT_VERSION_V2 = "cover-image-prompt-v2"
DRAFT_KIND = "v2_conversation"
MAX_VISUAL = 400
_EDITABLE = frozenset({"draft", "review", "approved"})


def _qa_from_turns(turns) -> list[dict]:
    items: list[dict] = []
    if not isinstance(turns, list):
        return items
    for turn in turns:
        if len(items) >= MAX_QA_ITEMS:
            break
        if not isinstance(turn, dict):
            continue
        question = _clip(turn.get("question"), MAX_QUESTION)
        answer = _clip(turn.get("answer"), MAX_ANSWER)
        if not question and not answer:
            continue
        items.append({"question": question, "answer": answer})
    return items


def _normalize_visual(value: str | None) -> str:
    return _clip(value, MAX_VISUAL)


def snapshot_v2(draft, business_id, *, visual_direction: str = "") -> DraftSnapshot:
    from backend.services.business_yansi.service import fail, uid

    if draft is None or uid(draft.business_id) != uid(business_id):
        fail("draft_not_found", 404)
    if str(draft.status) not in _EDITABLE:
        fail("draft_not_editable", 409)
    if str(draft.status) == "published":
        fail("draft_immutable", 409)
    revision = draft.revision
    if type(revision) is not int or revision < 1:
        fail("draft_revision_invalid", 409)
    title = _clip(draft.title, MAX_TITLE)
    summary = _clip(draft.summary, MAX_SUMMARY)
    curiosity = ""
    turns = draft.turns if isinstance(draft.turns, list) else []
    if turns and isinstance(turns[0], dict):
        curiosity = _clip(turns[0].get("question"), MAX_QUESTION)
    qa_items = _qa_from_turns(draft.turns)
    if not title or not qa_items:
        fail("cover_ai_draft_incomplete", 422)
    direction = _normalize_visual(visual_direction)
    fingerprint = content_fingerprint(
        title,
        summary,
        qa_items,
        curiosity=curiosity,
        visual_direction=direction,
        prompt_version=PROMPT_VERSION_V2,
    )
    return DraftSnapshot(
        draft_id=str(draft.id),
        business_id=str(draft.business_id),
        revision=revision,
        source_hash=str(draft.content_digest or ""),
        title=title,
        summary=summary,
        qa_items=qa_items,
        content_fingerprint=fingerprint,
        status=str(draft.status),
        curiosity=curiosity,
        visual_direction=direction,
        draft_kind=DRAFT_KIND,
        prompt_version=PROMPT_VERSION_V2,
    )


def _pin_version_ids(draft) -> list:
    from backend.services.business_yansi.service import uid

    ordered = []
    seen = set()
    pins = draft.knowledge_source_pins if isinstance(draft.knowledge_source_pins, list) else []
    for pin in pins:
        if not isinstance(pin, dict):
            continue
        raw = pin.get("knowledgeVersionId") or pin.get("knowledge_version_id")
        try:
            key = uid(raw)
        except Exception:
            continue
        if key in seen:
            continue
        seen.add(key)
        ordered.append(key)
    return ordered


async def _load_v2_draft(db, business_id, draft_id):
    from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft as Draft
    from backend.services.business_yansi.service import fail, uid

    row = await db.get(Draft, uid(draft_id))
    if row is None or uid(row.business_id) != uid(business_id):
        fail("draft_not_found", 404)
    return row


async def _require_default_backend():
    quote_for("image_cover")


async def suggest_image_cover_v2(
    db,
    business_id,
    actor_id,
    draft_id,
    idempotency_key,
    *,
    visual_direction: str | None = None,
    provider=None,
):
    """Reserve one image-cover proposal from a V2 conversation draft."""
    from fastapi import HTTPException

    from backend.services.business_yansi.service import access, fail, uid

    if not enabled():
        fail("cover_ai_disabled", 403)
    await cleanup_expired_previews(db, limit=50)
    try:
        await access(db, business_id, actor_id, "editor")
        draft = await _load_v2_draft(db, business_id, draft_id)
        snapshot = snapshot_v2(draft, business_id, visual_direction=visual_direction or "")
        if provider is None:
            await _require_default_backend()
            provider = ImageGenerationProvider(snapshot)
        else:
            quote_for("image_cover")
    except HTTPException:
        await db.rollback()
        raise
    row = await run_proposal(
        db,
        business_id,
        actor_id,
        kind="image_cover",
        idempotency_key=idempotency_key,
        payload=snapshot.payload(),
        provider=provider,
    )
    if row is None:
        fail("cover_suggestion_not_found", 404)
    return row


async def current_v2_draft_matches(db, row, business_id, draft_id) -> bool:
    expected = _payload_identity(row.request_payload if isinstance(row.request_payload, dict) else {})
    if expected is None:
        return False
    try:
        draft = await _load_v2_draft(db, business_id, draft_id)
        payload = row.request_payload if isinstance(row.request_payload, dict) else {}
        direction = payload.get("visualDirection") if isinstance(payload.get("visualDirection"), str) else ""
        live = snapshot_v2(draft, business_id, visual_direction=direction).identity()
    except Exception:
        return False
    return live == expected


async def read_image_suggestion_v2(db, business_id, actor_id, draft_id, proposal_id):
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.services.business_yansi.service import access, fail, uid

    await access(db, business_id, actor_id, "viewer")
    await cleanup_expired_previews(db, limit=20)
    row = await db.get(Proposal, uid(proposal_id))
    owner = uid(business_id)
    if row is None or row.business_id != owner or row.kind != "image_cover":
        fail("cover_suggestion_not_found", 404)
    row = await reconcile_proposal(db, row)
    payload = row.request_payload if isinstance(row.request_payload, dict) else {}
    if payload.get("draftKind") != DRAFT_KIND:
        fail("cover_suggestion_not_found", 404)
    try:
        stored_draft = uid(payload.get("draftId"))
    except Exception:
        fail("cover_suggestion_not_found", 404)
    if stored_draft != uid(draft_id):
        fail("cover_suggestion_not_found", 404)
    current = await current_v2_draft_matches(db, row, business_id, draft_id)
    return present_image_suggestion(row, draft_id, source_current=current)


async def read_image_preview_v2(db, business_id, actor_id, draft_id, proposal_id) -> tuple[bytes, str]:
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.services.business_yansi.service import access, fail, uid

    await access(db, business_id, actor_id, "viewer")
    row = await db.get(Proposal, uid(proposal_id))
    owner = uid(business_id)
    if row is None or row.business_id != owner or row.kind != "image_cover":
        fail("cover_suggestion_not_found", 404)
    row = await reconcile_proposal(db, row)
    if row.status != "succeeded":
        fail("cover_ai_preview_unavailable", 409)
    payload = row.request_payload if isinstance(row.request_payload, dict) else {}
    if payload.get("draftKind") != DRAFT_KIND:
        fail("cover_suggestion_not_found", 404)
    try:
        if uid(payload.get("draftId")) != uid(draft_id):
            fail("cover_suggestion_not_found", 404)
    except Exception:
        fail("cover_suggestion_not_found", 404)
    if not await current_v2_draft_matches(db, row, business_id, draft_id):
        fail("cover_ai_draft_stale", 409)
    result = row.result_payload if isinstance(row.result_payload, dict) else {}
    if preview_expired(result):
        fail("cover_ai_preview_expired", 409)
    blob, meta = read_preview_bytes(business_id, proposal_id, expected_sha256=result.get("sha256"))
    mime = meta.get("mimeType") if isinstance(meta.get("mimeType"), str) else None
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        fail("cover_ai_preview_corrupt", 409)
    return blob, mime


async def confirm_image_suggestion_v2(
    db,
    business_id,
    actor_id,
    draft_id,
    proposal_id,
    *,
    public_allowed: bool,
    link_version_ids=None,
    expected_revision: int | None = None,
    bind_cover: bool = True,
):
    """Promote preview → brand asset, then optionally bind cover on the V2 draft.

    Requires explicit public_allowed=True (Keşfet eligibility). Does not mutate
    frozen publications — only the editable draft revision.
    """
    from backend.services.business_yansi.service import fail, uid
    from backend.services.yansi import conversation_draft_v2 as drafts

    if public_allowed is not True:
        fail("cover_ai_public_required", 422)

    draft = await _load_v2_draft(db, business_id, draft_id)
    if str(draft.status) == "published":
        fail("draft_immutable", 409)
    if expected_revision is not None and int(draft.revision) != int(expected_revision):
        fail("revision_conflict", 409)

    pin_ids = _pin_version_ids(draft)
    versions = list(link_version_ids) if link_version_ids else list(pin_ids)
    if not versions:
        fail("cover_ai_links_required", 422)

    # Confirm reuses V1 pipeline against a synthetic V1-shaped identity check.
    # V2 proposals store draftKind + content_digest as sourceHash; the shared
    # confirm path loads BusinessYansiDraft by draftId and would 404. So we
    # confirm via a V2-aware internal path that mirrors confirm_image_suggestion
    # asset promotion, then revise the V2 draft.
    asset = await _confirm_v2_asset(
        db,
        business_id,
        actor_id,
        draft_id,
        proposal_id,
        link_version_ids=versions,
    )

    draft_dto = None
    if bind_cover:
        # Reload for revision after confirm transaction.
        draft = await _load_v2_draft(db, business_id, draft_id)
        if str(draft.status) == "published":
            fail("draft_immutable", 409)
        turns = list(draft.turns or [])
        pins = list(draft.knowledge_source_pins or [])
        notes = list(draft.knowledge_notes or [])
        draft_dto = await drafts.revise_conversation_draft_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(actor_id),
            draft_id=str(draft_id),
            expected_revision=int(draft.revision),
            title=str(draft.title or ""),
            summary=str(draft.summary or ""),
            turns=turns,
            knowledge_sources=pins or None,
            knowledge_notes=notes or None,
            cover_asset_id=str(asset.id),
            cover_asset_revision=int(asset.revision),
            commit=True,
        )
    return {"asset": asset, "draft": draft_dto}


async def _confirm_v2_asset(db, business_id, actor_id, draft_id, proposal_id, *, link_version_ids):
    """Promote private preview into a published public brand image for V2 drafts."""
    from backend.models.business_brand_assets import BusinessBrandAsset as Asset
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.services.business_yansi.brand_asset_library import (
        _apply_fields,
        image_locator,
        store_image,
    )
    from backend.services.business_yansi.brand_assets import normalize_asset
    from backend.services.business_yansi.cover_image_suggestions import (
        _apply_links_locked,
        _assert_image_cover_selectable,
        _validate_link_targets,
    )
    from backend.services.business_yansi.service import access, fail, uid
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor
    from sqlalchemy import update

    await access(db, business_id, actor_id, "editor")
    business_key = uid(business_id)
    actor_key = uid(actor_id)
    proposal_key = uid(proposal_id)
    draft_key = uid(draft_id)

    async with business_media_lock(db, business_key):
        await require_locked_actor(db, business_key, actor_key, "editor")
        with db.no_autoflush:
            proposal = await db.execute(
                select(Proposal)
                .where(
                    Proposal.id == proposal_key,
                    Proposal.business_id == business_key,
                    Proposal.kind == "image_cover",
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            row = proposal.scalar_one_or_none()
        if row is None:
            fail("cover_suggestion_not_found", 404)
        if row.status != "succeeded":
            fail("cover_ai_confirm_unavailable", 409)
        payload = row.request_payload if isinstance(row.request_payload, dict) else {}
        if payload.get("draftKind") != DRAFT_KIND:
            fail("cover_suggestion_not_found", 404)
        try:
            if uid(payload.get("draftId")) != draft_key:
                fail("cover_suggestion_not_found", 404)
        except Exception:
            fail("cover_suggestion_not_found", 404)

        draft = await _load_v2_draft(db, business_key, draft_key)
        if str(draft.status) == "published":
            fail("draft_immutable", 409)
        draft_sources = _pin_version_ids(draft)
        result = dict(row.result_payload) if isinstance(row.result_payload, dict) else {}
        existing_id = result.get("confirmedAssetId")
        # Idempotent re-confirm: after bindCover revise, digest/revision change — still return asset.
        if isinstance(existing_id, str) and existing_id:
            asset = await db.get(Asset, uid(existing_id))
            if asset is None or asset.business_id != business_key:
                fail("cover_ai_confirm_corrupt", 409)
            await db.refresh(asset)
            try:
                await _assert_image_cover_selectable(db, business_key, asset, draft_sources)
            except Exception:
                await db.rollback()
                raise
            await db.commit()
            return asset

        direction = payload.get("visualDirection") if isinstance(payload.get("visualDirection"), str) else ""
        live = snapshot_v2(draft, business_key, visual_direction=direction)
        expected = _payload_identity(payload)
        if expected is None or live.identity() != expected:
            fail("cover_ai_draft_stale", 409)

        knowledge_rows = await _validate_link_targets(
            db, business_key, link_version_ids, draft_source_ids=draft_sources,
        )

        blob, meta = read_preview_bytes(business_key, proposal_key, expected_sha256=result.get("sha256"))
        locator = image_locator(business_key, blob)
        store_image(business_key, blob)
        fields = normalize_asset(
            business_id=business_key,
            asset_type="image",
            title=_clip(live.title, 120) or "AI kapak önerisi",
            caption="AI kapak önerisi (onaylandı)",
            locator_kind="storage",
            locator=locator,
        )
        asset = Asset(business_id=business_key, created_by=actor_key, revision=1)
        _apply_fields(asset, fields, actor_key, True)  # public_allowed required for Keşfet
        db.add(asset)
        await db.flush()
        await _apply_links_locked(db, business_key, asset, knowledge_rows)
        await db.flush()
        try:
            await _assert_image_cover_selectable(db, business_key, asset, draft_sources)
        except Exception:
            await db.rollback()
            raise
        result.update({
            "confirmedAssetId": str(asset.id),
            "previewKey": meta.get("previewKey"),
            "sha256": meta.get("sha256"),
            "mimeType": meta.get("mimeType"),
            "byteLength": meta.get("byteLength"),
            "width": meta.get("width"),
            "height": meta.get("height"),
            "expiresAt": meta.get("expiresAt"),
        })
        row.result_payload = result
        updated = await db.execute(
            update(Proposal)
            .where(
                Proposal.id == proposal_key,
                Proposal.status == "succeeded",
                Proposal.business_id == business_key,
            )
            .values(result_payload=result)
            .execution_options(synchronize_session=False)
        )
        if updated.rowcount != 1:
            await db.rollback()
            fail("cover_ai_confirm_conflict", 409)
        await db.commit()
        await db.refresh(asset)

    try:
        from backend.services.business_yansi.cover_ai_preview_store import delete_preview

        delete_preview(business_key, proposal_key)
    except Exception:
        pass
    return asset


# Re-export for tests / prompt inspection
__all__ = [
    "PROMPT_VERSION_V2",
    "DRAFT_KIND",
    "snapshot_v2",
    "suggest_image_cover_v2",
    "read_image_suggestion_v2",
    "read_image_preview_v2",
    "confirm_image_suggestion_v2",
    "current_v2_draft_matches",
    "build_image_prompt",
    "MAX_PROMPT_CHARS",
    "CoverAiProviderError",
]
