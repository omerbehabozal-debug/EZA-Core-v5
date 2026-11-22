"""Public read of sealed Yansı V2 publication versions.

Returns only public DTO fields. Draft / private / hash-mismatched rows fail closed.
Does not expose locators, storage keys, or sealed private bundle text.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select

from backend.models.mirror_network import MirrorNetworkNode, YansiPublicationVersionV2
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi.publication_context import (
    PublicationContextError,
    verify_contract_integrity,
)
from backend.services.yansi.public_projection import (
    PublicProjectionError,
    to_public_conversation_publication_dto,
    to_public_image_publication_dto,
)


class PublicReadError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


async def _resolve_v2_business_publisher(
    db,
    bundle: YansiKnowledgeBundle,
) -> dict[str, Any] | None:
    """Reliable brand from sealed knowledge bundle — never invents BusinessPublication."""
    from backend.models.business_yansi import BusinessProfile
    from backend.models.production import Organization
    from backend.services.business_yansi.publication import enabled, publisher

    if not enabled():
        return None
    if bundle.business_id is None:
        return None
    profile = await db.get(BusinessProfile, bundle.business_id)
    organization = await db.get(Organization, bundle.business_id)
    if (
        not profile
        or profile.status != "active"
        or not organization
        or organization.status != "active"
    ):
        return None
    return publisher(profile)


def _uuid(value: Any, code: str = "publication_invalid_id") -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise PublicReadError(code) from exc


async def load_public_v2_rows(
    db,
    *,
    slug: str,
    publication_version: int | None = None,
) -> tuple[MirrorNetworkNode, YansiPublicationVersionV2, YansiKnowledgeBundle, YansiKnowledgeBundleVersion]:
    slug_text = (slug or "").strip().lower()
    if not slug_text:
        raise PublicReadError("node_not_found")

    node = await db.scalar(
        select(MirrorNetworkNode).where(MirrorNetworkNode.slug == slug_text)
    )
    if node is None:
        raise PublicReadError("node_not_found")
    if (node.visibility or "").lower() != "public":
        raise PublicReadError("not_public")
    if node.published_at is None:
        raise PublicReadError("draft_not_readable")
    if node.current_v2_publication_version is None and publication_version is None:
        raise PublicReadError("publication_not_found")

    version = (
        int(publication_version)
        if publication_version is not None
        else int(node.current_v2_publication_version)
    )
    if version < 1:
        raise PublicReadError("publication_not_found")

    publication = await db.scalar(
        select(YansiPublicationVersionV2).where(
            YansiPublicationVersionV2.node_id == node.id,
            YansiPublicationVersionV2.publication_version == version,
        )
    )
    if publication is None:
        raise PublicReadError("publication_not_found")

    if publication.knowledge_bundle_version_id is None:
        raise PublicReadError("bundle_not_found")
    bundle_version = await db.get(
        YansiKnowledgeBundleVersion, publication.knowledge_bundle_version_id
    )
    if bundle_version is None:
        raise PublicReadError("bundle_not_found")
    if (bundle_version.status or "").lower() != "sealed":
        raise PublicReadError("bundle_not_sealed")
    bundle = await db.get(YansiKnowledgeBundle, bundle_version.bundle_id)
    if bundle is None:
        raise PublicReadError("bundle_not_found")

    # Contract integrity — fail closed on tamper / drift.
    try:
        verify_contract_integrity({
            "node_id": publication.node_id,
            "publication_version": publication.publication_version,
            "response_policy": publication.response_policy,
            "content_kind": publication.content_kind,
            "content_manifest": publication.content_manifest,
            "manifest_hash": publication.manifest_hash,
            "contract_hash": publication.contract_hash,
            "knowledge_bundle_version_ref": publication.knowledge_bundle_version_ref,
        })
        pub.validate_contract({
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
        })
    except (PublicationContextError, pub.YansiV2ContractError) as exc:
        raise PublicReadError(getattr(exc, "code", "contract_hash_mismatch")) from exc

    return node, publication, bundle, bundle_version


def _asset_and_business_from_manifest(manifest: dict[str, Any]) -> tuple[str, str]:
    blocks = (manifest or {}).get("blocks") or []
    if len(blocks) != 1 or blocks[0].get("type") != "image":
        raise PublicReadError("public_manifest_invalid")
    asset_id = str(blocks[0].get("assetId") or "").lower()
    path = str(blocks[0].get("contentPath") or "")
    prefix = "/api/business-yansi/public-media/"
    if not path.startswith(prefix) or not asset_id:
        raise PublicReadError("public_media_path_invalid")
    parts = path[len(prefix):].split("/")
    if len(parts) != 2:
        raise PublicReadError("public_media_path_invalid")
    business_id, path_asset = parts[0].lower(), parts[1].lower()
    if path_asset != asset_id:
        raise PublicReadError("public_asset_mismatch")
    _uuid(business_id, "public_media_path_invalid")
    _uuid(asset_id, "public_asset_mismatch")
    return asset_id, business_id


def _contract_dict(publication: YansiPublicationVersionV2) -> dict[str, Any]:
    return {
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


def _bundle_envelope(
    bundle: YansiKnowledgeBundle,
    bundle_version: YansiKnowledgeBundleVersion,
) -> dict[str, Any]:
    return {
        "schemaVersion": "yansi-knowledge-bundle-v1",
        "bundleId": str(bundle.id).lower(),
        "bundleVersionId": str(bundle_version.id).lower(),
        "version": bundle_version.version,
        "status": bundle_version.status,
        "accessScope": bundle.access_scope,
        "bundleHash": bundle_version.bundle_hash,
        "items": list(bundle_version.items_manifest or []),
        "businessId": str(bundle.business_id).lower() if bundle.business_id else None,
        "ownerUserId": str(bundle.owner_user_id).lower(),
    }


async def read_public_image_publication(
    db,
    *,
    slug: str,
    publication_version: int | None = None,
    expected_contract_hash: str | None = None,
) -> dict[str, Any]:
    """Image-only public read (Stage 3A). Prefer read_public_v2_publication for dispatch."""
    node, publication, bundle, bundle_version = await load_public_v2_rows(
        db, slug=slug, publication_version=publication_version,
    )
    if expected_contract_hash is not None:
        if str(expected_contract_hash).lower() != str(publication.contract_hash).lower():
            raise PublicReadError("contract_hash_mismatch")

    asset_id, business_id = _asset_and_business_from_manifest(publication.content_manifest)
    if bundle.business_id is not None and str(bundle.business_id).lower() != business_id:
        raise PublicReadError("public_asset_mismatch")

    try:
        dto = to_public_image_publication_dto(
            contract=_contract_dict(publication),
            slug=node.slug,
            bundle_envelope=_bundle_envelope(bundle, bundle_version),
            asset_id=asset_id,
            business_id=business_id,
        )
    except PublicProjectionError as exc:
        raise PublicReadError(exc.code) from exc

    return {
        "status": "ok",
        "slug": node.slug,
        "nodeId": str(node.id).lower(),
        "publicationVersion": publication.publication_version,
        "isCurrent": publication.publication_version == node.current_v2_publication_version,
        "public": dto,
    }


async def read_public_v2_publication(
    db,
    *,
    slug: str,
    publication_version: int | None = None,
    expected_contract_hash: str | None = None,
) -> dict[str, Any]:
    """Dispatch public read for image-only and frozen-conversation V2 publications."""
    node, publication, bundle, bundle_version = await load_public_v2_rows(
        db, slug=slug, publication_version=publication_version,
    )
    if expected_contract_hash is not None:
        if str(expected_contract_hash).lower() != str(publication.contract_hash).lower():
            raise PublicReadError("contract_hash_mismatch")

    kind = (publication.content_kind or "").lower()
    contract = _contract_dict(publication)
    envelope = _bundle_envelope(bundle, bundle_version)

    try:
        if kind == "image":
            asset_id, business_id = _asset_and_business_from_manifest(publication.content_manifest)
            if bundle.business_id is not None and str(bundle.business_id).lower() != business_id:
                raise PublicReadError("public_asset_mismatch")
            dto = to_public_image_publication_dto(
                contract=contract,
                slug=node.slug,
                bundle_envelope=envelope,
                asset_id=asset_id,
                business_id=business_id,
            )
        elif kind in {"conversation", "mixed"}:
            business_id = str(bundle.business_id).lower() if bundle.business_id else None
            dto = to_public_conversation_publication_dto(
                contract=contract,
                slug=node.slug,
                bundle_envelope=envelope,
                business_id=business_id,
            )
        else:
            raise PublicReadError("public_manifest_invalid")
    except PublicProjectionError as exc:
        raise PublicReadError(exc.code) from exc

    brand = await _resolve_v2_business_publisher(db, bundle)
    return {
        "status": "ok",
        "slug": node.slug,
        "nodeId": str(node.id).lower(),
        "publicationVersion": publication.publication_version,
        "isCurrent": publication.publication_version == node.current_v2_publication_version,
        "contentKind": kind,
        "businessPublisher": brand,
        "public": dto,
    }
