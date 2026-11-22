"""Yansı V2 Stage 3A — single-image grounded publish service (no HTTP).

Publishes one Business-owned image with zero conversation turns:
seal Knowledge Bundle → immutable publication version → node pointer.

Transaction: one commit for bundle seal + publication row + node pointer.
Partial failure leaves no public V2 version. Does not open routers or call paid AI.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessKnowledgeVersion, BusinessMember, BusinessProfile
from backend.models.mirror_network import (
    ARTIFACT_KIND_LEGACY_LANDING,
    MirrorNetworkNode,
    YansiPublicationVersionV2,
)
from backend.models.production import Organization, User
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.mirror_network.slug import generate_mirror_slug
from backend.services.yansi import knowledge_bundle as kb
from backend.services.yansi.public_projection import to_public_image_publication_dto


class ImagePublishV2Error(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _uuid(value: Any, code: str = "invalid_id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ImagePublishV2Error(code) from exc


def _uuid_str(value: Any, code: str = "invalid_id") -> str:
    return str(_uuid(value, code)).lower()


def public_media_path(business_id: str, asset_id: str) -> str:
    return (
        f"/api/business-yansi/public-media/"
        f"{_uuid_str(business_id)}/{_uuid_str(asset_id)}"
    )


def build_image_only_manifest(*, business_id: str, asset_id: str, title: str) -> dict[str, Any]:
    return {
        "blocks": [
            {
                "type": "image",
                "assetId": _uuid_str(asset_id),
                "title": title,
                "contentPath": public_media_path(business_id, asset_id),
            }
        ]
    }


def assert_owner_membership(membership: BusinessMember | None) -> None:
    if membership is None or membership.role != "owner":
        raise ImagePublishV2Error("owner_required")


def assert_image_asset_publishable(
    asset: BusinessBrandAsset | None,
    *,
    business_id: uuid.UUID,
    expected_revision: int,
) -> BusinessBrandAsset:
    if asset is None:
        raise ImagePublishV2Error("asset_not_found")
    if asset.business_id != business_id:
        raise ImagePublishV2Error("foreign_tenant_asset")
    if asset.asset_type != "image":
        raise ImagePublishV2Error("asset_not_image")
    if asset.status != "published":
        raise ImagePublishV2Error("asset_not_published")
    if not asset.public_allowed:
        raise ImagePublishV2Error("asset_not_public")
    if asset.approved_by is None:
        raise ImagePublishV2Error("asset_not_approved")
    if int(asset.revision) != int(expected_revision):
        raise ImagePublishV2Error("revision_conflict")
    if not asset.locator or asset.locator_kind not in {"storage", "https"}:
        raise ImagePublishV2Error("asset_locator_invalid")
    return asset


_MAX_KNOWLEDGE_NOTES = 8
_MAX_NOTE_CHARS = 8000
_MAX_LINKED_KNOWLEDGE = 32
_MAX_BUNDLE_ITEMS = 64


def _normalize_knowledge_notes(raw: list[str] | None) -> list[str]:
    """User-approved creator notes only — never auto AI observations."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ImagePublishV2Error("invalid_knowledge_notes")
    if len(raw) > _MAX_KNOWLEDGE_NOTES:
        raise ImagePublishV2Error("too_many_knowledge_notes")
    notes: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            raise ImagePublishV2Error("invalid_knowledge_notes")
        text = item.strip()
        if not text:
            continue
        if len(text) > _MAX_NOTE_CHARS:
            raise ImagePublishV2Error("knowledge_note_too_long")
        notes.append(text)
    return notes


def _normalize_knowledge_source_pins(raw: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Client pins are lookup tokens only — server re-loads and re-digests rows."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ImagePublishV2Error("invalid_knowledge_sources")
    if len(raw) > _MAX_LINKED_KNOWLEDGE:
        raise ImagePublishV2Error("too_many_knowledge_sources")
    pins: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise ImagePublishV2Error("invalid_knowledge_sources")
        vid = item.get("knowledgeVersionId") or item.get("knowledge_version_id")
        rev = item.get("expectedRevision")
        if rev is None:
            rev = item.get("expected_revision")
        try:
            version_id = str(uuid.UUID(str(vid))).lower()
            revision = int(rev)
        except (TypeError, ValueError, AttributeError) as exc:
            raise ImagePublishV2Error("invalid_knowledge_sources") from exc
        if isinstance(rev, bool) or revision < 0:
            raise ImagePublishV2Error("invalid_knowledge_sources")
        if version_id in seen:
            raise ImagePublishV2Error("duplicate_knowledge_source")
        seen.add(version_id)
        pins.append({"knowledgeVersionId": version_id, "expectedRevision": revision})
    return pins


def assert_knowledge_version_linkable(
    row: BusinessKnowledgeVersion | None,
    *,
    business_id: uuid.UUID,
    expected_revision: int,
) -> BusinessKnowledgeVersion:
    if row is None:
        raise ImagePublishV2Error("knowledge_source_not_found")
    if row.business_id != business_id:
        raise ImagePublishV2Error("foreign_tenant_knowledge")
    if (row.status or "").lower() != "published":
        raise ImagePublishV2Error("knowledge_source_not_ready")
    if int(row.revision) != int(expected_revision):
        raise ImagePublishV2Error("revision_conflict")
    content = row.content if isinstance(row.content, str) else ""
    if not content.strip():
        raise ImagePublishV2Error("knowledge_source_empty")
    return row


def build_image_bundle_items(
    *,
    asset: BusinessBrandAsset,
    description: str | None,
    knowledge_notes: list[str] | None = None,
    knowledge_rows: list[BusinessKnowledgeVersion] | None = None,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    index = 0
    text = (description or "").strip()
    if text:
        if len(text) > _MAX_NOTE_CHARS:
            raise ImagePublishV2Error("description_too_long")
        items.append({
            "index": index,
            "sourceKind": "creator_text",
            "provenanceType": "creator",
            "contentDigest": kb.compute_creator_text_digest(text),
            "usageAllowed": True,
            "viewAllowed": True,
            "text": text,
            "title": "Description",
        })
        index += 1
    for note in _normalize_knowledge_notes(knowledge_notes):
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
    for row in knowledge_rows or []:
        items.append({
            "index": index,
            "sourceKind": "knowledge_version",
            "provenanceType": "business_knowledge",
            "sourceRefId": str(row.id).lower(),
            "knowledgeVersion": int(row.version),
            "contentDigest": kb.compute_knowledge_digest(row.content),
            "usageAllowed": True,
            # View only when the Business marked the pool entry public.
            "viewAllowed": bool(row.public_allowed),
            "title": (row.title or "Knowledge")[:200],
        })
        index += 1
    digest = kb.compute_asset_digest(
        asset_id=str(asset.id),
        revision=int(asset.revision),
        asset_type=asset.asset_type,
        locator_kind=asset.locator_kind,
        locator=asset.locator,
    )
    items.append({
        "index": index,
        "sourceKind": "image_asset",
        "provenanceType": "brand_asset",
        "sourceRefId": str(asset.id).lower(),
        "contentDigest": digest,
        "usageAllowed": True,
        "viewAllowed": True,
        "title": (asset.title or "Image")[:200],
    })
    if len(items) > _MAX_BUNDLE_ITEMS:
        raise ImagePublishV2Error("bundle_too_large")
    return items


def next_publication_version(current: int | None) -> int:
    if current is None:
        return 1
    if not isinstance(current, int) or isinstance(current, bool) or current < 0:
        raise ImagePublishV2Error("invalid_current_version")
    return current + 1


async def _lock_owner_context(db, business_id: uuid.UUID, actor_user_id: uuid.UUID):
    business = await db.get(BusinessProfile, business_id)
    organization = await db.get(Organization, business_id)
    actor = await db.get(User, actor_user_id)
    if not business or not organization or organization.status != "active" or business.status != "active":
        raise ImagePublishV2Error("business_not_found")
    if not actor or not actor.is_active:
        raise ImagePublishV2Error("inactive_account")
    membership = await db.get(BusinessMember, (business_id, actor_user_id))
    assert_owner_membership(membership)
    return business, actor


async def _load_asset_for_update(db, asset_id: uuid.UUID) -> BusinessBrandAsset | None:
    result = await db.execute(
        select(BusinessBrandAsset)
        .where(BusinessBrandAsset.id == asset_id)
        .with_for_update()
    )
    return result.scalar_one_or_none()


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
    actor: User,
    title: str,
    slug: str | None,
    node_id: uuid.UUID | None,
    expected_current_version: int | None,
    defer_version_check: bool = False,
) -> MirrorNetworkNode:
    """Load/create node under row lock.

    When ``defer_version_check`` is True (idempotent publish path), the
    ``expected_current_version`` gate runs only after the idempotency lookup
    so a concurrent winner with the same key can be returned safely.
    """
    if node_id is not None:
        result = await db.execute(
            select(MirrorNetworkNode).where(MirrorNetworkNode.id == node_id).with_for_update()
        )
        node = result.scalar_one_or_none()
        if node is None:
            raise ImagePublishV2Error("node_not_found")
        if node.user_id != actor.id:
            raise ImagePublishV2Error("node_owner_mismatch")
        if not defer_version_check and node.current_v2_publication_version != expected_current_version:
            raise ImagePublishV2Error("revision_conflict")
        return node

    candidate_slug = (slug or "").strip() or generate_mirror_slug(title)
    existing = await db.scalar(
        select(MirrorNetworkNode).where(MirrorNetworkNode.slug == candidate_slug)
    )
    if existing is not None:
        raise ImagePublishV2Error("slug_taken")

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    node = MirrorNetworkNode(
        id=uuid.uuid4(),
        slug=candidate_slug,
        user_id=actor.id,
        conversation_id=None,
        visibility="private",
        safety_status="open",
        card_title=title[:200],
        card_date=today,
        scene_image_url=None,
        public_payload={"yansiV2": True, "contentKind": "image"},
        private_payload={"yansiV2Publish": "image_grounded"},
        artifact_kind=ARTIFACT_KIND_LEGACY_LANDING,
        journey_version=1,
        freeze_status="non_frozen",
        current_v2_publication_version=None,
        published_at=None,
    )
    if not defer_version_check and expected_current_version is not None:
        raise ImagePublishV2Error("revision_conflict")
    db.add(node)
    await db.flush()
    return node


def _result_payload(
    *,
    node: MirrorNetworkNode,
    publication: YansiPublicationVersionV2,
    bundle_version: YansiKnowledgeBundleVersion,
    bundle: YansiKnowledgeBundle,
    asset: BusinessBrandAsset,
    sealed_items: list[dict[str, Any]],
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
    public = to_public_image_publication_dto(
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
        asset_id=str(asset.id).lower(),
        business_id=str(asset.business_id).lower(),
    )
    return {
        "status": "published",
        "idempotent": idempotent,
        "nodeId": str(node.id).lower(),
        "slug": node.slug,
        "publicationVersion": publication.publication_version,
        "contractHash": publication.contract_hash,
        "manifestHash": publication.manifest_hash,
        "bundleVersionId": str(bundle_version.id).lower(),
        "bundleHash": bundle_version.bundle_hash,
        "assetId": str(asset.id).lower(),
        "assetRevision": int(asset.revision),
        "public": public,
    }


async def publish_single_image_grounded_v2(
    db,
    *,
    business_id: str,
    actor_user_id: str,
    asset_id: str,
    expected_asset_revision: int,
    title: str,
    description: str | None = None,
    knowledge_notes: list[str] | None = None,
    knowledge_sources: list[dict[str, Any]] | None = None,
    slug: str | None = None,
    node_id: str | None = None,
    expected_current_version: int | None = None,
    idempotency_key: str | None = None,
    approval_note: str | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    """Atomically publish one grounded image Yansı V2.

    Concurrency tokens:
    - ``expected_asset_revision`` must match the locked asset revision.
    - ``expected_current_version`` must match ``node.current_v2_publication_version``
      (``None`` for first publish on a new or empty node).

    Idempotency: same ``idempotency_key`` on the same node returns the prior
    publication without creating a duplicate version.
    """
    biz = _uuid(business_id, "business_not_found")
    actor_id = _uuid(actor_user_id, "inactive_account")
    asset_uuid = _uuid(asset_id, "asset_not_found")
    node_uuid = _uuid(node_id) if node_id else None
    title_text = (title or "").strip()
    if not title_text or len(title_text) > 200:
        raise ImagePublishV2Error("invalid_title")
    if idempotency_key is not None:
        key = str(idempotency_key).strip()
        if not key or len(key) > 128:
            raise ImagePublishV2Error("invalid_idempotency_key")
        idempotency_key = key

    business, actor = await _lock_owner_context(db, biz, actor_id)
    asset = await _load_asset_for_update(db, asset_uuid)
    asset = assert_image_asset_publishable(
        asset,
        business_id=biz,
        expected_revision=expected_asset_revision,
    )

    node = await _resolve_or_create_node(
        db,
        actor=actor,
        title=title_text,
        slug=slug,
        node_id=node_uuid,
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
                raise ImagePublishV2Error("bundle_not_found")
            bundle = await db.get(YansiKnowledgeBundle, bundle_version.bundle_id)
            if bundle is None:
                raise ImagePublishV2Error("bundle_not_found")
            if commit:
                await db.commit()
            return _result_payload(
                node=node,
                publication=prior,
                bundle_version=bundle_version,
                bundle=bundle,
                asset=asset,
                sealed_items=list(bundle_version.items_manifest or []),
                idempotent=True,
            )
        # No prior publish for this key — enforce the caller's version token now.
        if node.current_v2_publication_version != expected_current_version:
            raise ImagePublishV2Error("revision_conflict")

    pins = _normalize_knowledge_source_pins(knowledge_sources)
    knowledge_rows: list[BusinessKnowledgeVersion] = []
    knowledge_live: dict[str, Any] = {}
    for pin in pins:
        row = await db.get(BusinessKnowledgeVersion, uuid.UUID(pin["knowledgeVersionId"]))
        row = assert_knowledge_version_linkable(
            row,
            business_id=biz,
            expected_revision=pin["expectedRevision"],
        )
        knowledge_rows.append(row)
        knowledge_live[str(row.id).lower()] = {
            "business_id": str(row.business_id).lower(),
            "content": row.content,
            "version": int(row.version),
            "title": row.title,
            "public_allowed": bool(row.public_allowed),
        }

    live_sources = {
        "assets": {
            str(asset.id).lower(): {
                "business_id": str(asset.business_id).lower(),
                "asset_type": asset.asset_type,
                "revision": int(asset.revision),
                "locator_kind": asset.locator_kind,
                "locator": asset.locator,
                "public_allowed": bool(asset.public_allowed),
                "title": asset.title,
            }
        },
        "knowledge_versions": knowledge_live,
    }
    try:
        items, bundle_hash = kb.build_authorized_manifest(
            build_image_bundle_items(
                asset=asset,
                description=description,
                knowledge_notes=knowledge_notes,
                knowledge_rows=knowledge_rows,
            ),
            business_id=str(biz).lower(),
            owner_user_id=str(actor.id).lower(),
            sources=live_sources,
        )
    except kb.KnowledgeBundleError as exc:
        raise ImagePublishV2Error(exc.code) from exc

    bundle = YansiKnowledgeBundle(
        id=uuid.uuid4(),
        business_id=biz,
        owner_user_id=actor.id,
        title=title_text[:200],
        access_scope="publication_bound",
    )
    db.add(bundle)
    await db.flush()

    bundle_version_id = uuid.uuid4()
    try:
        sealed = kb.seal_version_payload(
            bundle_id=str(bundle.id),
            bundle_version_id=str(bundle_version_id),
            version=1,
            access_scope="publication_bound",
            items=items,
            bundle_hash=bundle_hash,
            business_id=str(biz),
            owner_user_id=str(actor.id),
            approved_by=str(actor.id),
        )
    except kb.KnowledgeBundleError as exc:
        raise ImagePublishV2Error(exc.code) from exc

    # Re-read asset under the same lock before seal persist — reject mid-flight change.
    refreshed = await _load_asset_for_update(db, asset_uuid)
    assert_image_asset_publishable(
        refreshed,
        business_id=biz,
        expected_revision=expected_asset_revision,
    )
    live_digest = kb.compute_asset_digest(
        asset_id=str(refreshed.id),
        revision=int(refreshed.revision),
        asset_type=refreshed.asset_type,
        locator_kind=refreshed.locator_kind,
        locator=refreshed.locator,
    )
    image_item = next(item for item in items if item["sourceKind"] == "image_asset")
    if image_item["contentDigest"] != live_digest:
        raise ImagePublishV2Error("bundle_digest_mismatch")

    now = datetime.now(timezone.utc)
    bundle_version = YansiKnowledgeBundleVersion(
        id=bundle_version_id,
        bundle_id=bundle.id,
        version=1,
        status="sealed",
        items_manifest=items,
        bundle_hash=bundle_hash,
        created_by=actor.id,
        approved_by=actor.id,
        approval_note=(approval_note or "")[:500] or None,
        sealed_at=now,
    )
    db.add(bundle_version)
    await db.flush()

    publication_version = next_publication_version(node.current_v2_publication_version)
    manifest = build_image_only_manifest(
        business_id=str(biz),
        asset_id=str(asset.id),
        title=(asset.title or title_text)[:200],
    )
    approval_metadata = {
        "approvedBy": str(actor.id).lower(),
        "approvedAt": now.isoformat().replace("+00:00", "Z"),
        "note": (approval_note or "")[:500] or None,
    }

    try:
        contract = pub.build_contract(
            node_id=str(node.id),
            response_policy="grounded",
            content_kind="image",
            content_manifest=manifest,
            publication_version=publication_version,
            knowledge_bundle_version_ref=str(bundle_version.id).lower(),
            approval_metadata=approval_metadata,
        )
    except pub.YansiV2ContractError as exc:
        raise ImagePublishV2Error(exc.code) from exc

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
    node.current_v2_publication_version = publication_version
    node.visibility = "public"
    node.published_at = now
    node.card_title = title_text[:200]
    node.scene_image_url = public_media_path(str(biz), str(asset.id))
    private = dict(node.private_payload) if isinstance(node.private_payload, dict) else {}
    if idempotency_key:
        mapping = dict(private.get("v2Idempotency") or {})
        mapping[idempotency_key] = publication_version
        private["v2Idempotency"] = mapping
    private["yansiV2Publish"] = "image_grounded"
    node.private_payload = private
    node.public_payload = {
        **(node.public_payload if isinstance(node.public_payload, dict) else {}),
        "yansiV2": True,
        "contentKind": "image",
        "contractHash": contract["contractHash"],
        "publicationVersion": publication_version,
    }

    try:
        await db.flush()
    except IntegrityError as exc:
        recovered = await _recover_after_version_conflict(
            db,
            node_id=node.id,
            idempotency_key=idempotency_key,
            asset=asset,
            commit=commit,
        )
        if recovered is not None:
            return recovered
        raise ImagePublishV2Error("duplicate_publish") from exc

    if commit:
        try:
            await db.commit()
            await db.refresh(publication)
            await db.refresh(node)
            await db.refresh(bundle_version)
        except IntegrityError as exc:
            recovered = await _recover_after_version_conflict(
                db,
                node_id=node.id,
                idempotency_key=idempotency_key,
                asset=asset,
                commit=True,
            )
            if recovered is not None:
                return recovered
            raise ImagePublishV2Error("duplicate_publish") from exc

    return _result_payload(
        node=node,
        publication=publication,
        bundle_version=bundle_version,
        bundle=bundle,
        asset=asset,
        sealed_items=items,
        idempotent=False,
    )


async def _recover_after_version_conflict(
    db,
    *,
    node_id: uuid.UUID,
    idempotency_key: str | None,
    asset: BusinessBrandAsset,
    commit: bool,
) -> dict[str, Any] | None:
    """After a unique (node, version) race, return the winner if same idempotency key.

    Different keys racing on the same expected version stay ``duplicate_publish``.
    """
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
        asset=asset,
        sealed_items=list(bundle_version.items_manifest or []),
        idempotent=True,
    )
