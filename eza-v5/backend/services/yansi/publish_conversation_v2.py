"""Yansı V2 Stage 01 — publish an approved frozen conversation (1–8 turns).

Requires ConversationDraftV2 approval bound to revision + content_digest.
Reuses Knowledge Bundle seal + publication version rows from image V2.
Does not alter V1 Studio or image-only publish paths.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessKnowledgeVersion
from backend.models.mirror_network import (
    ARTIFACT_KIND_LEGACY_LANDING,
    MirrorNetworkNode,
    YansiPublicationVersionV2,
)
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.mirror_network.slug import generate_mirror_slug
from backend.services.yansi import conversation_draft_v2 as drafts
from backend.services.yansi import knowledge_bundle as kb
from backend.services.yansi.public_projection import to_public_conversation_publication_dto
from backend.services.yansi.publish_image_v2 import (
    ImagePublishV2Error,
    assert_image_asset_publishable,
    next_publication_version,
    public_media_path,
)


class ConversationPublishV2Error(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


_MAX_BUNDLE_ITEMS = 64
_MAX_NOTE_CHARS = 8000


def _map_draft_error(exc: drafts.ConversationDraftV2Error) -> ConversationPublishV2Error:
    return ConversationPublishV2Error(exc.code)


def _uuid(value: Any, code: str = "invalid_id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ConversationPublishV2Error(code) from exc


async def _resolve_turn_media(
    db,
    *,
    business_id: uuid.UUID,
    turns: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Build sealed media blocks + live source map for bundle digest checks."""
    sealed_turns: list[dict[str, Any]] = []
    assets_live: dict[str, dict[str, Any]] = {}
    for turn in turns:
        media_blocks: list[dict[str, Any]] = []
        for media in turn.get("media") or []:
            asset = await db.get(BusinessBrandAsset, uuid.UUID(media["assetId"]))
            if asset is None:
                raise ConversationPublishV2Error("asset_not_found")
            if asset.business_id != business_id:
                raise ConversationPublishV2Error("foreign_tenant_asset")
            if int(asset.revision) != int(media["assetRevision"]):
                raise ConversationPublishV2Error("revision_conflict")
            if asset.status != "published" or not asset.public_allowed or asset.approved_by is None:
                raise ConversationPublishV2Error("asset_not_published")
            if media["type"] == "image":
                if asset.asset_type != "image":
                    raise ConversationPublishV2Error("asset_type_mismatch")
                try:
                    assert_image_asset_publishable(
                        asset,
                        business_id=business_id,
                        expected_revision=int(media["assetRevision"]),
                    )
                except ImagePublishV2Error as exc:
                    raise ConversationPublishV2Error(exc.code) from exc
                media_blocks.append({
                    "type": "image",
                    "assetId": str(asset.id).lower(),
                    "title": media["title"][:200],
                    "contentPath": public_media_path(str(business_id), str(asset.id)),
                    "assetRevision": int(asset.revision),
                })
            elif media["type"] == "video":
                if asset.asset_type != "video":
                    raise ConversationPublishV2Error("asset_type_mismatch")
                if asset.locator_kind != "https" or not asset.locator:
                    raise ConversationPublishV2Error("video_media_https_required")
                media_blocks.append({
                    "type": "video",
                    "assetId": str(asset.id).lower(),
                    "title": media["title"][:200],
                    "href": asset.locator,
                    "assetRevision": int(asset.revision),
                })
            else:
                raise ConversationPublishV2Error("invalid_turn_media")
            assets_live[str(asset.id).lower()] = {
                "business_id": str(asset.business_id).lower(),
                "asset_type": asset.asset_type,
                "revision": int(asset.revision),
                "locator_kind": asset.locator_kind,
                "locator": asset.locator,
                "public_allowed": bool(asset.public_allowed),
                "title": asset.title,
            }
        sealed_turns.append({
            "stepIndex": turn["stepIndex"],
            "question": turn["question"],
            "answer": turn["answer"],
            "media": media_blocks,
        })
    return sealed_turns, assets_live


def build_conversation_manifest(
    *,
    turns: list[dict[str, Any]],
    cover: dict[str, Any] | None = None,
) -> dict[str, Any]:
    blocks: list[dict[str, Any]] = [
        {"type": "frozen_conversation", "turns": turns},
    ]
    if cover is not None:
        blocks.append(cover)
    return {"blocks": blocks}


def build_conversation_bundle_items(
    *,
    turns: list[dict[str, Any]],
    knowledge_notes: list[str],
    knowledge_rows: list[BusinessKnowledgeVersion],
    media_assets: list[BusinessBrandAsset],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    index = 0
    for turn in turns:
        text = f"Q: {turn['question']}\nA: {turn['answer']}"
        if len(text) > _MAX_NOTE_CHARS:
            raise ConversationPublishV2Error("frozen_turn_too_long")
        items.append({
            "index": index,
            "sourceKind": "creator_text",
            "provenanceType": "creator",
            "contentDigest": kb.compute_creator_text_digest(text),
            "usageAllowed": True,
            "viewAllowed": True,
            "text": text,
            "title": f"Turn {turn['stepIndex']}",
        })
        index += 1
    for note in knowledge_notes:
        items.append({
            "index": index,
            "sourceKind": "creator_text",
            "provenanceType": "creator",
            "contentDigest": kb.compute_creator_text_digest(note),
            "usageAllowed": True,
            "viewAllowed": True,
            "text": note,
            "title": "Bilgi notu",
        })
        index += 1
    for row in knowledge_rows:
        items.append({
            "index": index,
            "sourceKind": "knowledge_version",
            "provenanceType": "business_knowledge",
            "sourceRefId": str(row.id).lower(),
            "knowledgeVersion": int(row.version),
            "contentDigest": kb.compute_knowledge_digest(row.content),
            "usageAllowed": True,
            "viewAllowed": bool(row.public_allowed),
            "title": (row.title or "Knowledge")[:200],
        })
        index += 1
    for asset in media_assets:
        digest = kb.compute_asset_digest(
            asset_id=str(asset.id),
            revision=int(asset.revision),
            asset_type=asset.asset_type,
            locator_kind=asset.locator_kind,
            locator=asset.locator,
        )
        kind = "image_asset" if asset.asset_type == "image" else "video_asset"
        items.append({
            "index": index,
            "sourceKind": kind,
            "provenanceType": "brand_asset",
            "sourceRefId": str(asset.id).lower(),
            "contentDigest": digest,
            "usageAllowed": True,
            "viewAllowed": True,
            "title": (asset.title or asset.asset_type)[:200],
        })
        index += 1
    if len(items) > _MAX_BUNDLE_ITEMS:
        raise ConversationPublishV2Error("bundle_too_large")
    return items


def _idempotency_map(node: MirrorNetworkNode) -> dict[str, int]:
    private = node.private_payload if isinstance(node.private_payload, dict) else {}
    raw = private.get("v2Idempotency") or {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, int] = {}
    for key, version in raw.items():
        if isinstance(key, str) and isinstance(version, int) and not isinstance(version, bool):
            out[key] = version
    return out


async def _find_idempotent_publication(
    db,
    *,
    node: MirrorNetworkNode,
    idempotency_key: str,
) -> YansiPublicationVersionV2 | None:
    version = _idempotency_map(node).get(idempotency_key)
    if version is None:
        return None
    return await db.scalar(
        select(YansiPublicationVersionV2).where(
            YansiPublicationVersionV2.node_id == node.id,
            YansiPublicationVersionV2.publication_version == version,
        )
    )


async def _resolve_or_create_node(
    db,
    *,
    actor_id: uuid.UUID,
    title: str,
    slug: str | None,
    node_id: uuid.UUID | None,
    expected_current_version: int | None,
    defer_version_check: bool,
) -> MirrorNetworkNode:
    if node_id is not None:
        result = await db.execute(
            select(MirrorNetworkNode).where(MirrorNetworkNode.id == node_id).with_for_update()
        )
        node = result.scalar_one_or_none()
        if node is None:
            raise ConversationPublishV2Error("node_not_found")
        if node.user_id != actor_id:
            raise ConversationPublishV2Error("node_owner_mismatch")
        if not defer_version_check and node.current_v2_publication_version != expected_current_version:
            raise ConversationPublishV2Error("revision_conflict")
        return node

    candidate_slug = (slug or "").strip() or generate_mirror_slug(title)
    existing = await db.scalar(
        select(MirrorNetworkNode).where(MirrorNetworkNode.slug == candidate_slug)
    )
    if existing is not None:
        raise ConversationPublishV2Error("slug_taken")

    now = datetime.now(timezone.utc)
    node = MirrorNetworkNode(
        id=uuid.uuid4(),
        slug=candidate_slug,
        user_id=actor_id,
        conversation_id=None,
        visibility="private",
        safety_status="open",
        card_title=title[:200],
        card_date=now.date().isoformat(),
        scene_image_url=None,
        public_payload={"yansiV2": True, "contentKind": "conversation"},
        private_payload={"yansiV2Publish": "conversation_frozen"},
        artifact_kind=ARTIFACT_KIND_LEGACY_LANDING,
        journey_version=1,
        freeze_status="non_frozen",
        current_v2_publication_version=None,
        published_at=None,
    )
    if not defer_version_check and expected_current_version is not None:
        raise ConversationPublishV2Error("revision_conflict")
    db.add(node)
    await db.flush()
    return node


def _result_payload(
    *,
    node: MirrorNetworkNode,
    publication: YansiPublicationVersionV2,
    bundle_version: YansiKnowledgeBundleVersion,
    bundle: YansiKnowledgeBundle,
    sealed_items: list[dict[str, Any]],
    draft: YansiV2ConversationDraft,
    idempotent: bool,
) -> dict[str, Any]:
    contract = {
        "contractVersion": publication.contract_version,
        "nodeId": str(publication.node_id).lower(),
        "responsePolicy": publication.response_policy,
        "contentKind": publication.content_kind,
        "contentManifest": publication.content_manifest,
        "manifestHash": publication.manifest_hash,
        "contractHash": publication.contract_hash,
        "knowledgeBundleVersionRef": publication.knowledge_bundle_version_ref,
        "publicationVersion": publication.publication_version,
        "approvalMetadata": publication.approval_metadata,
    }
    public = to_public_conversation_publication_dto(
        contract=contract,
        slug=node.slug,
        bundle_envelope={
            "schemaVersion": "yansi-knowledge-bundle-v1",
            "bundleId": str(bundle.id).lower(),
            "bundleVersionId": str(bundle_version.id).lower(),
            "version": bundle_version.version,
            "status": bundle_version.status,
            "accessScope": bundle.access_scope,
            "bundleHash": bundle_version.bundle_hash,
            "items": sealed_items,
            "businessId": str(bundle.business_id).lower() if bundle.business_id else None,
            "ownerUserId": str(bundle.owner_user_id).lower(),
        },
        business_id=str(draft.business_id).lower(),
    )
    return {
        "status": "published",
        "idempotent": idempotent,
        "nodeId": str(node.id).lower(),
        "slug": node.slug,
        "draftId": str(draft.id).lower(),
        "publicationVersion": publication.publication_version,
        "contractHash": publication.contract_hash,
        "manifestHash": publication.manifest_hash,
        "bundleVersionId": str(bundle_version.id).lower(),
        "bundleHash": bundle_version.bundle_hash,
        "curiosityQuestion": public["conversation"]["curiosityQuestion"],
        "turnCount": public["conversation"]["turnCount"],
        "public": public,
    }


async def publish_approved_conversation_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    draft_id: str,
    expected_draft_revision: int,
    slug: str | None = None,
    node_id: str | None = None,
    expected_current_version: int | None = None,
    idempotency_key: str | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    """Atomically publish an approved frozen conversation draft.

    Concurrency:
    - draft row locked; approval revision/digest re-checked
    - knowledge + media revision pins re-checked
    - node version token + idempotency key (same as image V2)
    """
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    draft_uuid = _uuid(draft_id, "draft_not_found")
    node_uuid = _uuid(node_id) if node_id else None
    if idempotency_key is not None:
        key = str(idempotency_key).strip()
        if not key or len(key) > 128:
            raise ConversationPublishV2Error("invalid_idempotency_key")
        idempotency_key = key

    try:
        await drafts._lock_actor_context(db, biz, actor_id, minimum="owner")
        draft = await drafts._load_draft_for_update(db, business_id=biz, draft_id=draft_uuid)
    except drafts.ConversationDraftV2Error as exc:
        raise _map_draft_error(exc) from exc

    if int(draft.revision) != int(expected_draft_revision):
        raise ConversationPublishV2Error("revision_conflict")

    # Prefer existing published node for idempotent retries (draft may already be published).
    resolve_node_id = node_uuid or draft.published_node_id
    node = await _resolve_or_create_node(
        db,
        actor_id=actor_id,
        title=draft.title,
        slug=slug,
        node_id=resolve_node_id,
        expected_current_version=expected_current_version,
        defer_version_check=bool(idempotency_key),
    )

    if idempotency_key:
        prior = await _find_idempotent_publication(
            db, node=node, idempotency_key=idempotency_key,
        )
        if prior is not None:
            bundle_version = await db.get(
                YansiKnowledgeBundleVersion,
                uuid.UUID(str(prior.knowledge_bundle_version_ref)),
            )
            if bundle_version is None:
                raise ConversationPublishV2Error("bundle_not_found")
            bundle = await db.get(YansiKnowledgeBundle, bundle_version.bundle_id)
            if bundle is None:
                raise ConversationPublishV2Error("bundle_not_found")
            if commit:
                await db.commit()
            return _result_payload(
                node=node,
                publication=prior,
                bundle_version=bundle_version,
                bundle=bundle,
                sealed_items=list(bundle_version.items_manifest or []),
                draft=draft,
                idempotent=True,
            )
        if node.current_v2_publication_version != expected_current_version:
            raise ConversationPublishV2Error("revision_conflict")

    try:
        drafts.assert_draft_approval_current(draft)
    except drafts.ConversationDraftV2Error as exc:
        raise _map_draft_error(exc) from exc

    try:
        turns = drafts.normalize_draft_turns(draft.turns)
        pins = drafts.normalize_knowledge_source_pins(list(draft.knowledge_source_pins or []))
        notes = drafts.normalize_knowledge_notes(list(draft.knowledge_notes or []))
        await drafts.assert_media_pins_owned(
            db,
            business_id=biz,
            turns=turns,
            cover_asset_id=draft.cover_asset_id,
            cover_asset_revision=draft.cover_asset_revision,
        )
        knowledge_rows = await drafts.assert_knowledge_pins_owned(db, business_id=biz, pins=pins)
    except drafts.ConversationDraftV2Error as exc:
        raise _map_draft_error(exc) from exc

    live_digest = drafts.compute_draft_content_digest(
        title=draft.title,
        summary=draft.summary or "",
        turns=turns,
        knowledge_source_pins=pins,
        knowledge_notes=notes,
        cover_asset_id=str(draft.cover_asset_id).lower() if draft.cover_asset_id else None,
        cover_asset_revision=draft.cover_asset_revision,
    )
    if live_digest != draft.content_digest or live_digest != draft.approved_content_digest:
        raise ConversationPublishV2Error("approval_stale")

    sealed_turns, assets_live = await _resolve_turn_media(db, business_id=biz, turns=turns)

    cover_block = None
    media_assets: list[BusinessBrandAsset] = []
    seen_assets: set[str] = set()
    for asset_id in assets_live:
        asset = await db.get(BusinessBrandAsset, uuid.UUID(asset_id))
        if asset is not None and asset_id not in seen_assets:
            media_assets.append(asset)
            seen_assets.add(asset_id)

    if draft.cover_asset_id is not None:
        cover = await db.get(BusinessBrandAsset, draft.cover_asset_id)
        try:
            cover = assert_image_asset_publishable(
                cover,
                business_id=biz,
                expected_revision=int(draft.cover_asset_revision),
            )
        except ImagePublishV2Error as exc:
            raise ConversationPublishV2Error(exc.code) from exc
        cover_block = {
            "type": "image",
            "assetId": str(cover.id).lower(),
            "title": (cover.title or draft.title)[:200],
            "contentPath": public_media_path(str(biz), str(cover.id)),
        }
        if str(cover.id).lower() not in seen_assets:
            media_assets.append(cover)
            assets_live[str(cover.id).lower()] = {
                "business_id": str(cover.business_id).lower(),
                "asset_type": cover.asset_type,
                "revision": int(cover.revision),
                "locator_kind": cover.locator_kind,
                "locator": cover.locator,
                "public_allowed": bool(cover.public_allowed),
                "title": cover.title,
            }

    knowledge_live = {
        str(row.id).lower(): {
            "business_id": str(row.business_id).lower(),
            "content": row.content,
            "version": int(row.version),
            "title": row.title,
            "public_allowed": bool(row.public_allowed),
        }
        for row in knowledge_rows
    }
    try:
        items, bundle_hash = kb.build_authorized_manifest(
            build_conversation_bundle_items(
                turns=sealed_turns,
                knowledge_notes=notes,
                knowledge_rows=knowledge_rows,
                media_assets=media_assets,
            ),
            business_id=str(biz).lower(),
            owner_user_id=str(actor_id).lower(),
            sources={
                "assets": assets_live,
                "knowledge_versions": knowledge_live,
            },
        )
    except kb.KnowledgeBundleError as exc:
        raise ConversationPublishV2Error(exc.code) from exc

    bundle = YansiKnowledgeBundle(
        id=uuid.uuid4(),
        business_id=biz,
        owner_user_id=actor_id,
        title=draft.title[:200],
        access_scope="publication_bound",
    )
    db.add(bundle)
    await db.flush()

    bundle_version_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    try:
        sealed = kb.seal_version_payload(
            bundle_id=str(bundle.id),
            bundle_version_id=str(bundle_version_id),
            version=1,
            access_scope="publication_bound",
            items=items,
            bundle_hash=bundle_hash,
            business_id=str(biz),
            owner_user_id=str(actor_id),
            approved_by=str(draft.approved_by),
        )
    except kb.KnowledgeBundleError as exc:
        raise ConversationPublishV2Error(exc.code) from exc
    del sealed  # validated; row stores items + hash

    bundle_version = YansiKnowledgeBundleVersion(
        id=bundle_version_id,
        bundle_id=bundle.id,
        version=1,
        status="sealed",
        items_manifest=items,
        bundle_hash=bundle_hash,
        created_by=actor_id,
        approved_by=draft.approved_by,
        approval_note=draft.approval_note,
        sealed_at=now,
    )
    db.add(bundle_version)
    await db.flush()

    publication_version = next_publication_version(node.current_v2_publication_version)
    content_kind = "mixed" if cover_block is not None else "conversation"
    manifest = build_conversation_manifest(turns=sealed_turns, cover=cover_block)
    approval_metadata = {
        "approvedBy": str(draft.approved_by).lower(),
        "approvedAt": (
            draft.approved_at.isoformat().replace("+00:00", "Z")
            if draft.approved_at
            else now.isoformat().replace("+00:00", "Z")
        ),
        "note": draft.approval_note,
    }
    try:
        contract = pub.build_contract(
            node_id=str(node.id),
            response_policy="grounded",
            content_kind=content_kind,
            content_manifest=manifest,
            publication_version=publication_version,
            knowledge_bundle_version_ref=str(bundle_version.id).lower(),
            approval_metadata=approval_metadata,
        )
    except pub.YansiV2ContractError as exc:
        raise ConversationPublishV2Error(exc.code) from exc

    publication = YansiPublicationVersionV2(
        id=uuid.uuid4(),
        node_id=node.id,
        publication_version=publication_version,
        contract_version=contract["contractVersion"],
        response_policy=contract["responsePolicy"],
        content_kind=contract["contentKind"],
        content_manifest=contract["contentManifest"],
        manifest_hash=contract["manifestHash"],
        contract_hash=contract["contractHash"],
        knowledge_bundle_version_ref=contract["knowledgeBundleVersionRef"],
        knowledge_bundle_version_id=bundle_version.id,
        approval_metadata=contract.get("approvalMetadata"),
    )
    db.add(publication)

    draft.status = "published"
    draft.published_node_id = node.id
    draft.published_version = publication_version
    draft.revision = int(draft.revision) + 1

    node.current_v2_publication_version = publication_version
    node.visibility = "public"
    node.published_at = now
    node.card_title = draft.title[:200]
    if cover_block is not None:
        node.scene_image_url = cover_block["contentPath"]
    private = dict(node.private_payload) if isinstance(node.private_payload, dict) else {}
    if idempotency_key:
        mapping = dict(private.get("v2Idempotency") or {})
        mapping[idempotency_key] = publication_version
        private["v2Idempotency"] = mapping
    private["yansiV2Publish"] = "conversation_frozen"
    private["v2ConversationDraftId"] = str(draft.id).lower()
    node.private_payload = private
    node.public_payload = {
        **(node.public_payload if isinstance(node.public_payload, dict) else {}),
        "yansiV2": True,
        "contentKind": content_kind,
        "contractHash": contract["contractHash"],
        "publicationVersion": publication_version,
        "curiosityQuestion": sealed_turns[0]["question"],
        "turnCount": len(sealed_turns),
    }

    try:
        await db.flush()
    except IntegrityError as exc:
        recovered = await _recover_after_version_conflict(
            db,
            node_id=node.id,
            idempotency_key=idempotency_key,
            draft=draft,
            commit=commit,
        )
        if recovered is not None:
            return recovered
        raise ConversationPublishV2Error("duplicate_publish") from exc

    if commit:
        try:
            await db.commit()
            await db.refresh(publication)
            await db.refresh(node)
            await db.refresh(bundle_version)
            await db.refresh(draft)
        except IntegrityError as exc:
            recovered = await _recover_after_version_conflict(
                db,
                node_id=node.id,
                idempotency_key=idempotency_key,
                draft=draft,
                commit=True,
            )
            if recovered is not None:
                return recovered
            raise ConversationPublishV2Error("duplicate_publish") from exc

    return _result_payload(
        node=node,
        publication=publication,
        bundle_version=bundle_version,
        bundle=bundle,
        sealed_items=items,
        draft=draft,
        idempotent=False,
    )


async def _recover_after_version_conflict(
    db,
    *,
    node_id: uuid.UUID,
    idempotency_key: str | None,
    draft: YansiV2ConversationDraft,
    commit: bool,
) -> dict[str, Any] | None:
    await db.rollback()
    if not idempotency_key:
        return None
    result = await db.execute(
        select(MirrorNetworkNode).where(MirrorNetworkNode.id == node_id).with_for_update()
    )
    node = result.scalar_one_or_none()
    if node is None:
        return None
    prior = await _find_idempotent_publication(
        db, node=node, idempotency_key=idempotency_key,
    )
    if prior is None:
        return None
    bundle_version = await db.get(
        YansiKnowledgeBundleVersion,
        uuid.UUID(str(prior.knowledge_bundle_version_ref)),
    )
    if bundle_version is None:
        return None
    bundle = await db.get(YansiKnowledgeBundle, bundle_version.bundle_id)
    if bundle is None:
        return None
    if commit:
        await db.commit()
    return _result_payload(
        node=node,
        publication=prior,
        bundle_version=bundle_version,
        bundle=bundle,
        sealed_items=list(bundle_version.items_manifest or []),
        draft=draft,
        idempotent=True,
    )
