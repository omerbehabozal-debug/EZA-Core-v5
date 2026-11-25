"""Yansı V2 frozen conversation draft lifecycle (Draft → Review → Approved).

Does not use BusinessYansiDraft or the V1 mandatory eight-step Studio rule.
Turn count is 1–8 inclusive. Approval binds to revision + content_digest.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select

from backend.core.schemas.yansi_v2_publication import (
    MAX_FROZEN_TURNS,
    MIN_FROZEN_TURNS,
    FrozenConversationBlock,
)
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessKnowledgeVersion, BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.services.mirror_network import yansi_v2_contract as pub


class ConversationDraftV2Error(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


# Sentinel for revise(): omit cover fields → keep existing cover binding.
COVER_ASSET_UNSET: object = object()


TRANSITIONS = {
    "draft": {"review"},
    "review": {"draft", "approved"},
    "approved": {"draft", "published"},
    "published": {"archived"},
    "archived": set(),
}

_MAX_KNOWLEDGE_NOTES = 8
_MAX_NOTE_CHARS = 8000
_MAX_LINKED_KNOWLEDGE = 32
_MAX_TURN_MEDIA = 4


def _uuid(value: Any, code: str = "invalid_id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ConversationDraftV2Error(code) from exc


def _uuid_str(value: Any, code: str = "invalid_id") -> str:
    return str(_uuid(value, code)).lower()


def assert_membership(
    membership: BusinessMember | None,
    *,
    minimum: str,
) -> None:
    if membership is None:
        raise ConversationDraftV2Error("membership_required")
    role = (membership.role or "").lower()
    if minimum == "owner" and role != "owner":
        raise ConversationDraftV2Error("owner_required")
    if minimum == "editor" and role not in {"owner", "editor"}:
        raise ConversationDraftV2Error("editor_required")


def normalize_knowledge_notes(raw: list[str] | None) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ConversationDraftV2Error("invalid_knowledge_notes")
    if len(raw) > _MAX_KNOWLEDGE_NOTES:
        raise ConversationDraftV2Error("too_many_knowledge_notes")
    notes: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            raise ConversationDraftV2Error("invalid_knowledge_notes")
        text = item.strip()
        if not text:
            continue
        if len(text) > _MAX_NOTE_CHARS:
            raise ConversationDraftV2Error("knowledge_note_too_long")
        notes.append(text)
    return notes


def normalize_knowledge_source_pins(raw: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ConversationDraftV2Error("invalid_knowledge_sources")
    if len(raw) > _MAX_LINKED_KNOWLEDGE:
        raise ConversationDraftV2Error("too_many_knowledge_sources")
    pins: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise ConversationDraftV2Error("invalid_knowledge_sources")
        vid = item.get("knowledgeVersionId") or item.get("knowledge_version_id")
        rev = item.get("expectedRevision")
        if rev is None:
            rev = item.get("expected_revision")
        try:
            version_id = str(uuid.UUID(str(vid))).lower()
            revision = int(rev)
        except (TypeError, ValueError, AttributeError) as exc:
            raise ConversationDraftV2Error("invalid_knowledge_sources") from exc
        if isinstance(rev, bool) or revision < 0:
            raise ConversationDraftV2Error("invalid_knowledge_sources")
        if version_id in seen:
            raise ConversationDraftV2Error("duplicate_knowledge_source")
        seen.add(version_id)
        pins.append({"knowledgeVersionId": version_id, "expectedRevision": revision})
    return pins


def _normalize_turn_media(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ConversationDraftV2Error("invalid_turn_media")
    if len(raw) > _MAX_TURN_MEDIA:
        raise ConversationDraftV2Error("too_many_turn_media")
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise ConversationDraftV2Error("invalid_turn_media")
        media_type = item.get("type")
        asset_id = item.get("assetId") or item.get("asset_id")
        revision = item.get("assetRevision")
        if revision is None:
            revision = item.get("asset_revision")
        title = item.get("title")
        try:
            asset_uuid = str(uuid.UUID(str(asset_id))).lower()
            rev_int = int(revision)
        except (TypeError, ValueError, AttributeError) as exc:
            raise ConversationDraftV2Error("invalid_turn_media") from exc
        if isinstance(revision, bool) or rev_int < 0:
            raise ConversationDraftV2Error("invalid_turn_media")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ConversationDraftV2Error("invalid_turn_media")
        if media_type not in {"image", "video"}:
            raise ConversationDraftV2Error("invalid_turn_media")
        out.append({
            "type": media_type,
            "assetId": asset_uuid,
            "assetRevision": rev_int,
            "title": title.strip(),
        })
    return out


def normalize_draft_turns(raw: Any) -> list[dict[str, Any]]:
    """Normalize client turns into sealed-ready Q/A pairs (1–8)."""
    if not isinstance(raw, list):
        raise ConversationDraftV2Error("invalid_turns")
    count = len(raw)
    if count < MIN_FROZEN_TURNS:
        raise ConversationDraftV2Error("turns_too_few")
    if count > MAX_FROZEN_TURNS:
        raise ConversationDraftV2Error("turns_too_many")

    turns: list[dict[str, Any]] = []
    for index, item in enumerate(raw, start=1):
        if not isinstance(item, dict):
            raise ConversationDraftV2Error("invalid_turns")
        step = item.get("stepIndex", item.get("step_index", index))
        try:
            step_index = int(step)
        except (TypeError, ValueError) as exc:
            raise ConversationDraftV2Error("frozen_turn_order_invalid") from exc
        if isinstance(step, bool) or step_index != index:
            raise ConversationDraftV2Error("frozen_turn_order_invalid")
        question = item.get("question")
        answer = item.get("answer")
        if not isinstance(question, str) or not isinstance(answer, str):
            raise ConversationDraftV2Error("frozen_turn_empty")
        q = question.strip()
        a = answer.strip()
        if not q or not a:
            raise ConversationDraftV2Error("frozen_turn_empty")
        if question != q or answer != a:
            raise ConversationDraftV2Error("frozen_turn_padding")
        if len(q) > 8000 or len(a) > 8000:
            raise ConversationDraftV2Error("frozen_turn_too_long")
        turns.append({
            "stepIndex": step_index,
            "question": q,
            "answer": a,
            "media": _normalize_turn_media(item.get("media")),
        })

    # Structural check via schema (order + non-empty already enforced).
    FrozenConversationBlock.model_validate({"type": "frozen_conversation", "turns": [
        {
            "stepIndex": t["stepIndex"],
            "question": t["question"],
            "answer": t["answer"],
            "media": [],
        }
        for t in turns
    ]})
    return turns


def compute_draft_content_digest(
    *,
    title: str,
    summary: str,
    turns: list[dict[str, Any]],
    knowledge_source_pins: list[dict[str, Any]],
    knowledge_notes: list[str],
    cover_asset_id: str | None,
    cover_asset_revision: int | None,
) -> str:
    payload = {
        "title": title,
        "summary": summary,
        "turns": turns,
        "knowledgeSourcePins": knowledge_source_pins,
        "knowledgeNotes": knowledge_notes,
        "coverAssetId": cover_asset_id,
        "coverAssetRevision": cover_asset_revision,
    }
    return pub.digest_text(pub.canonical_json(payload))


def draft_public_dto(row: YansiV2ConversationDraft) -> dict[str, Any]:
    return {
        "id": str(row.id).lower(),
        "businessId": str(row.business_id).lower(),
        "title": row.title,
        "summary": row.summary or "",
        "turns": list(row.turns or []),
        "turnCount": len(row.turns or []),
        "curiosityQuestion": (row.turns or [{}])[0].get("question") if row.turns else None,
        "knowledgeSourcePins": list(row.knowledge_source_pins or []),
        "knowledgeNotes": list(row.knowledge_notes or []),
        "coverAssetId": str(row.cover_asset_id).lower() if row.cover_asset_id else None,
        "coverAssetRevision": row.cover_asset_revision,
        "contentDigest": row.content_digest,
        "status": row.status,
        "revision": int(row.revision),
        "approvedBy": str(row.approved_by).lower() if row.approved_by else None,
        "approvedAt": row.approved_at.isoformat().replace("+00:00", "Z") if row.approved_at else None,
        "approvedRevision": row.approved_revision,
        "approvedContentDigest": row.approved_content_digest,
        "approvalNote": row.approval_note,
        "publishedNodeId": str(row.published_node_id).lower() if row.published_node_id else None,
        "publishedVersion": row.published_version,
        "createdBy": str(row.created_by).lower(),
        "createdAt": row.created_at.isoformat().replace("+00:00", "Z") if row.created_at else None,
        "updatedAt": row.updated_at.isoformat().replace("+00:00", "Z") if row.updated_at else None,
    }


def draft_list_summary_dto(row: YansiV2ConversationDraft) -> dict[str, Any]:
    """List payload — metadata only; no turns / notes / pins / digests."""
    return {
        "id": str(row.id).lower(),
        "businessId": str(row.business_id).lower(),
        "title": row.title,
        "status": row.status,
        "revision": int(row.revision),
        "turnCount": len(row.turns or []),
        "coverAssetId": str(row.cover_asset_id).lower() if row.cover_asset_id else None,
        "publishedNodeId": str(row.published_node_id).lower() if row.published_node_id else None,
        "publishedVersion": row.published_version,
        "createdAt": row.created_at.isoformat().replace("+00:00", "Z") if row.created_at else None,
        "updatedAt": row.updated_at.isoformat().replace("+00:00", "Z") if row.updated_at else None,
    }


_LIST_STATUSES = frozenset({"draft", "review", "approved", "published", "archived"})
_LIST_DEFAULT_LIMIT = 50
_LIST_MAX_LIMIT = 100


async def list_conversation_drafts_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    status: str | None = None,
    limit: int = _LIST_DEFAULT_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    """Member list of tenant-scoped conversation drafts (viewer+). Summary rows only."""
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    business = await db.get(BusinessProfile, biz)
    organization = await db.get(Organization, biz)
    actor = await db.get(User, actor_id)
    if not business or not organization or organization.status != "active" or business.status != "active":
        raise ConversationDraftV2Error("business_not_found")
    if not actor or not actor.is_active:
        raise ConversationDraftV2Error("inactive_account")
    membership = await db.get(BusinessMember, (biz, actor_id))
    if membership is None or (membership.role or "").lower() not in {"owner", "editor", "viewer"}:
        raise ConversationDraftV2Error("membership_required")

    status_filter: str | None = None
    if status is not None and str(status).strip():
        status_filter = str(status).strip().lower()
        if status_filter not in _LIST_STATUSES:
            raise ConversationDraftV2Error("invalid_status")

    try:
        lim = int(limit)
        off = int(offset)
    except (TypeError, ValueError) as exc:
        raise ConversationDraftV2Error("invalid_pagination") from exc
    if isinstance(limit, bool) or isinstance(offset, bool) or lim < 1 or off < 0:
        raise ConversationDraftV2Error("invalid_pagination")
    lim = min(lim, _LIST_MAX_LIMIT)

    filters = [YansiV2ConversationDraft.business_id == biz]
    if status_filter:
        filters.append(YansiV2ConversationDraft.status == status_filter)

    total = int(
        await db.scalar(
            select(func.count()).select_from(YansiV2ConversationDraft).where(*filters)
        )
        or 0
    )
    rows = (
        await db.scalars(
            select(YansiV2ConversationDraft)
            .where(*filters)
            .order_by(
                YansiV2ConversationDraft.updated_at.desc(),
                YansiV2ConversationDraft.id.desc(),
            )
            .limit(lim)
            .offset(off)
        )
    ).all()

    return {
        "items": [draft_list_summary_dto(row) for row in rows],
        "total": total,
        "limit": lim,
        "offset": off,
    }


async def _lock_actor_context(db, business_id: uuid.UUID, actor_user_id: uuid.UUID, *, minimum: str):
    business = await db.get(BusinessProfile, business_id)
    organization = await db.get(Organization, business_id)
    actor = await db.get(User, actor_user_id)
    if not business or not organization or organization.status != "active" or business.status != "active":
        raise ConversationDraftV2Error("business_not_found")
    if not actor or not actor.is_active:
        raise ConversationDraftV2Error("inactive_account")
    membership = await db.get(BusinessMember, (business_id, actor_user_id))
    assert_membership(membership, minimum=minimum)
    return business, actor


async def get_conversation_draft_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    draft_id: str,
) -> dict[str, Any]:
    """Member read of a tenant-scoped draft (viewer+). No cross-tenant leak."""
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    draft_uuid = _uuid(draft_id, "draft_not_found")
    business = await db.get(BusinessProfile, biz)
    organization = await db.get(Organization, biz)
    actor = await db.get(User, actor_id)
    if not business or not organization or organization.status != "active" or business.status != "active":
        raise ConversationDraftV2Error("business_not_found")
    if not actor or not actor.is_active:
        raise ConversationDraftV2Error("inactive_account")
    membership = await db.get(BusinessMember, (biz, actor_id))
    if membership is None or (membership.role or "").lower() not in {"owner", "editor", "viewer"}:
        raise ConversationDraftV2Error("membership_required")
    row = await db.scalar(
        select(YansiV2ConversationDraft).where(
            YansiV2ConversationDraft.id == draft_uuid,
            YansiV2ConversationDraft.business_id == biz,
        )
    )
    if row is None:
        raise ConversationDraftV2Error("draft_not_found")
    return draft_public_dto(row)


async def _load_draft_for_update(
    db,
    *,
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
) -> YansiV2ConversationDraft:
    result = await db.execute(
        select(YansiV2ConversationDraft)
        .where(
            YansiV2ConversationDraft.id == draft_id,
            YansiV2ConversationDraft.business_id == business_id,
        )
        .with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ConversationDraftV2Error("draft_not_found")
    return row


async def assert_media_pins_owned(
    db,
    *,
    business_id: uuid.UUID,
    turns: list[dict[str, Any]],
    cover_asset_id: uuid.UUID | None = None,
    cover_asset_revision: int | None = None,
) -> None:
    """Validate tenant ownership + revision for every media pin (no locator leak)."""
    pins: list[tuple[uuid.UUID, int, str]] = []
    for turn in turns:
        for media in turn.get("media") or []:
            pins.append((
                uuid.UUID(media["assetId"]),
                int(media["assetRevision"]),
                media["type"],
            ))
    if cover_asset_id is not None:
        if cover_asset_revision is None:
            raise ConversationDraftV2Error("invalid_cover_asset")
        pins.append((cover_asset_id, int(cover_asset_revision), "image"))

    for asset_id, revision, expected_type in pins:
        asset = await db.get(BusinessBrandAsset, asset_id)
        if asset is None:
            raise ConversationDraftV2Error("asset_not_found")
        if asset.business_id != business_id:
            raise ConversationDraftV2Error("foreign_tenant_asset")
        if asset.asset_type != expected_type:
            raise ConversationDraftV2Error("asset_type_mismatch")
        if asset.status != "published":
            raise ConversationDraftV2Error("asset_not_published")
        if not asset.public_allowed:
            raise ConversationDraftV2Error("asset_not_public")
        if asset.approved_by is None:
            raise ConversationDraftV2Error("asset_not_approved")
        if int(asset.revision) != revision:
            raise ConversationDraftV2Error("revision_conflict")
        if expected_type == "image":
            if not asset.locator or asset.locator_kind not in {"storage", "https"}:
                raise ConversationDraftV2Error("asset_locator_invalid")
        elif expected_type == "video":
            # Reference-only HTTPS videos in this stage (no new video publish path).
            if asset.locator_kind != "https" or not asset.locator:
                raise ConversationDraftV2Error("video_media_https_required")


async def assert_knowledge_pins_owned(
    db,
    *,
    business_id: uuid.UUID,
    pins: list[dict[str, Any]],
) -> list[BusinessKnowledgeVersion]:
    rows: list[BusinessKnowledgeVersion] = []
    for pin in pins:
        row = await db.get(BusinessKnowledgeVersion, uuid.UUID(pin["knowledgeVersionId"]))
        if row is None:
            raise ConversationDraftV2Error("knowledge_source_not_found")
        if row.business_id != business_id:
            raise ConversationDraftV2Error("foreign_tenant_knowledge")
        if (row.status or "").lower() != "published":
            raise ConversationDraftV2Error("knowledge_source_not_ready")
        if int(row.revision) != int(pin["expectedRevision"]):
            raise ConversationDraftV2Error("revision_conflict")
        content = row.content if isinstance(row.content, str) else ""
        if not content.strip():
            raise ConversationDraftV2Error("knowledge_source_empty")
        rows.append(row)
    return rows


def _clear_approval(row: YansiV2ConversationDraft) -> None:
    row.approved_by = None
    row.approved_at = None
    row.approved_revision = None
    row.approved_content_digest = None
    row.approval_note = None


async def create_conversation_draft_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    title: str,
    turns: list[dict[str, Any]],
    summary: str | None = None,
    knowledge_sources: list[dict[str, Any]] | None = None,
    knowledge_notes: list[str] | None = None,
    cover_asset_id: str | None = None,
    cover_asset_revision: int | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    await _lock_actor_context(db, biz, actor_id, minimum="editor")

    title_text = (title or "").strip()
    if not title_text or len(title_text) > 200:
        raise ConversationDraftV2Error("invalid_title")
    summary_text = (summary or "").strip()
    if len(summary_text) > 500:
        raise ConversationDraftV2Error("invalid_summary")

    normalized_turns = normalize_draft_turns(turns)
    pins = normalize_knowledge_source_pins(knowledge_sources)
    notes = normalize_knowledge_notes(knowledge_notes)

    cover_uuid = _uuid(cover_asset_id, "invalid_cover_asset") if cover_asset_id else None
    cover_rev = None
    if cover_uuid is not None:
        if cover_asset_revision is None:
            raise ConversationDraftV2Error("invalid_cover_asset")
        cover_rev = int(cover_asset_revision)
        if isinstance(cover_asset_revision, bool) or cover_rev < 0:
            raise ConversationDraftV2Error("invalid_cover_asset")

    await assert_media_pins_owned(
        db,
        business_id=biz,
        turns=normalized_turns,
        cover_asset_id=cover_uuid,
        cover_asset_revision=cover_rev,
    )
    await assert_knowledge_pins_owned(db, business_id=biz, pins=pins)

    digest = compute_draft_content_digest(
        title=title_text,
        summary=summary_text,
        turns=normalized_turns,
        knowledge_source_pins=pins,
        knowledge_notes=notes,
        cover_asset_id=str(cover_uuid).lower() if cover_uuid else None,
        cover_asset_revision=cover_rev,
    )
    row = YansiV2ConversationDraft(
        id=uuid.uuid4(),
        business_id=biz,
        title=title_text,
        summary=summary_text,
        turns=normalized_turns,
        knowledge_source_pins=pins,
        knowledge_notes=notes,
        cover_asset_id=cover_uuid,
        cover_asset_revision=cover_rev,
        content_digest=digest,
        status="draft",
        revision=1,
        created_by=actor_id,
    )
    db.add(row)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(row)
    return draft_public_dto(row)


async def revise_conversation_draft_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    draft_id: str,
    expected_revision: int,
    title: str,
    turns: list[dict[str, Any]],
    summary: str | None = None,
    knowledge_sources: list[dict[str, Any]] | None = None,
    knowledge_notes: list[str] | None = None,
    cover_asset_id: Any = COVER_ASSET_UNSET,
    cover_asset_revision: int | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    """Revise draft content. Cover binding uses a three-state contract:

    - ``COVER_ASSET_UNSET`` / omitted: keep existing cover + revision
    - ``None``: clear cover
    - asset id string: replace cover (tenant/eligibility checks via assert_media_pins_owned)
    """
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    draft_uuid = _uuid(draft_id, "draft_not_found")
    await _lock_actor_context(db, biz, actor_id, minimum="editor")

    row = await _load_draft_for_update(db, business_id=biz, draft_id=draft_uuid)
    if int(row.revision) != int(expected_revision):
        raise ConversationDraftV2Error("revision_conflict")
    if row.status in {"published", "archived"}:
        raise ConversationDraftV2Error("draft_immutable")
    # Content edits always return to draft and invalidate approval.
    if row.status not in {"draft", "review", "approved"}:
        raise ConversationDraftV2Error("invalid_transition")

    title_text = (title or "").strip()
    if not title_text or len(title_text) > 200:
        raise ConversationDraftV2Error("invalid_title")
    summary_text = (summary or "").strip()
    if len(summary_text) > 500:
        raise ConversationDraftV2Error("invalid_summary")

    normalized_turns = normalize_draft_turns(turns)
    pins = normalize_knowledge_source_pins(knowledge_sources)
    notes = normalize_knowledge_notes(knowledge_notes)

    if cover_asset_id is COVER_ASSET_UNSET:
        cover_uuid = row.cover_asset_id
        cover_rev = row.cover_asset_revision
    elif cover_asset_id is None or cover_asset_id == "":
        cover_uuid = None
        cover_rev = None
    else:
        cover_uuid = _uuid(cover_asset_id, "invalid_cover_asset")
        if cover_asset_revision is None:
            raise ConversationDraftV2Error("invalid_cover_asset")
        cover_rev = int(cover_asset_revision)
        if isinstance(cover_asset_revision, bool) or cover_rev < 0:
            raise ConversationDraftV2Error("invalid_cover_asset")

    await assert_media_pins_owned(
        db,
        business_id=biz,
        turns=normalized_turns,
        cover_asset_id=cover_uuid,
        cover_asset_revision=cover_rev,
    )
    await assert_knowledge_pins_owned(db, business_id=biz, pins=pins)

    digest = compute_draft_content_digest(
        title=title_text,
        summary=summary_text,
        turns=normalized_turns,
        knowledge_source_pins=pins,
        knowledge_notes=notes,
        cover_asset_id=str(cover_uuid).lower() if cover_uuid else None,
        cover_asset_revision=cover_rev,
    )
    row.title = title_text
    row.summary = summary_text
    row.turns = normalized_turns
    row.knowledge_source_pins = pins
    row.knowledge_notes = notes
    row.cover_asset_id = cover_uuid
    row.cover_asset_revision = cover_rev
    row.content_digest = digest
    row.status = "draft"
    row.revision = int(row.revision) + 1
    _clear_approval(row)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(row)
    return draft_public_dto(row)


async def transition_conversation_draft_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    draft_id: str,
    target: str,
    expected_revision: int,
    approval_note: str | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    draft_uuid = _uuid(draft_id, "draft_not_found")
    target_status = (target or "").strip().lower()
    if target_status not in TRANSITIONS:
        raise ConversationDraftV2Error("invalid_transition")

    minimum = "owner" if target_status == "approved" else "editor"
    await _lock_actor_context(db, biz, actor_id, minimum=minimum)
    row = await _load_draft_for_update(db, business_id=biz, draft_id=draft_uuid)
    if int(row.revision) != int(expected_revision):
        raise ConversationDraftV2Error("revision_conflict")
    if target_status not in TRANSITIONS.get(row.status, set()):
        raise ConversationDraftV2Error("invalid_transition")
    if target_status == "published":
        # Publish is a separate service that seals the contract.
        raise ConversationDraftV2Error("use_publish_service")

    # Re-validate content and pins before review/approve.
    if target_status in {"review", "approved"}:
        turns = normalize_draft_turns(row.turns)
        pins = normalize_knowledge_source_pins(list(row.knowledge_source_pins or []))
        await assert_media_pins_owned(
            db,
            business_id=biz,
            turns=turns,
            cover_asset_id=row.cover_asset_id,
            cover_asset_revision=row.cover_asset_revision,
        )
        await assert_knowledge_pins_owned(db, business_id=biz, pins=pins)
        live_digest = compute_draft_content_digest(
            title=row.title,
            summary=row.summary or "",
            turns=turns,
            knowledge_source_pins=pins,
            knowledge_notes=list(row.knowledge_notes or []),
            cover_asset_id=str(row.cover_asset_id).lower() if row.cover_asset_id else None,
            cover_asset_revision=row.cover_asset_revision,
        )
        if live_digest != row.content_digest:
            raise ConversationDraftV2Error("content_digest_mismatch")

    if target_status == "approved":
        now = datetime.now(timezone.utc)
        row.status = "approved"
        row.approved_by = actor_id
        row.approved_at = now
        row.approved_revision = int(row.revision)
        row.approved_content_digest = row.content_digest
        row.approval_note = (approval_note or "").strip()[:500] or None
        row.revision = int(row.revision) + 1
    elif target_status == "review":
        row.status = "review"
        _clear_approval(row)
        row.revision = int(row.revision) + 1
    elif target_status == "draft":
        row.status = "draft"
        _clear_approval(row)
        row.revision = int(row.revision) + 1
    else:
        raise ConversationDraftV2Error("invalid_transition")

    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(row)
    return draft_public_dto(row)


def assert_draft_approval_current(row: YansiV2ConversationDraft) -> None:
    """Publish gate: approved status + matching revision/digest snapshot.

    After approve(), revision becomes approved_revision + 1 while content_digest
    stays equal to approved_content_digest until the next revise.
    """
    if row.status != "approved":
        raise ConversationDraftV2Error("approval_required")
    if row.approved_by is None or row.approved_revision is None or not row.approved_content_digest:
        raise ConversationDraftV2Error("approval_required")
    if row.approved_content_digest != row.content_digest:
        raise ConversationDraftV2Error("approval_stale")
    if int(row.revision) != int(row.approved_revision) + 1:
        raise ConversationDraftV2Error("approval_stale")
