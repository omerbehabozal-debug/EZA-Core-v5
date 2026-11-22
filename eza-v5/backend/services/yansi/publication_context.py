"""Server-verified Yansı V2 grounded publication context.

Clients may pass identifiers for lookup only. Contract hash, sealed bundle
identity, tenant ownership, and usage allowlists are resolved from server
rows — never from free-form client overrides.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import knowledge_bundle as kb


class PublicationContextError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class GroundedPublicationContext:
    """Immutable, server-verified start state for V2 Grounded answers."""

    node_id: str
    publication_version: int
    contract_hash: str
    manifest_hash: str
    response_policy: str
    content_kind: str
    business_id: str
    owner_user_id: str
    bundle_id: str
    bundle_version_id: str
    bundle_version_number: int
    bundle_hash: str
    access_scope: str
    items: tuple[dict[str, Any], ...] = field(default_factory=tuple)
    usage_knowledge_version_ids: frozenset[str] = field(default_factory=frozenset)
    view_knowledge_version_ids: frozenset[str] = field(default_factory=frozenset)
    usage_item_indexes: frozenset[int] = field(default_factory=frozenset)
    view_item_indexes: frozenset[int] = field(default_factory=frozenset)
    observation_item_indexes: frozenset[int] = field(default_factory=frozenset)
    dropped_digest_mismatches: tuple[str, ...] = field(default_factory=tuple)

    def to_public_dict(self) -> dict[str, Any]:
        """Identifiers only — no private locators or sealed private text."""
        return {
            "nodeId": self.node_id,
            "publicationVersion": self.publication_version,
            "contractHash": self.contract_hash,
            "manifestHash": self.manifest_hash,
            "responsePolicy": self.response_policy,
            "contentKind": self.content_kind,
            "businessId": self.business_id,
            "ownerUserId": self.owner_user_id,
            "bundleId": self.bundle_id,
            "bundleVersionId": self.bundle_version_id,
            "bundleVersion": self.bundle_version_number,
            "bundleHash": self.bundle_hash,
            "accessScope": self.access_scope,
            "usageKnowledgeVersionIds": sorted(self.usage_knowledge_version_ids),
            "viewKnowledgeVersionIds": sorted(self.view_knowledge_version_ids),
            "droppedDigestMismatches": list(self.dropped_digest_mismatches),
        }


def _uuid_str(value: Any, code: str = "publication_invalid_id") -> str:
    try:
        return str(UUID(str(value))).lower()
    except (TypeError, ValueError, AttributeError) as exc:
        raise PublicationContextError(code) from exc


def _row_get(row: Any, *names: str, default=None):
    if row is None:
        return default
    if isinstance(row, dict):
        for name in names:
            if name in row and row[name] is not None:
                return row[name]
        return default
    for name in names:
        if hasattr(row, name):
            value = getattr(row, name)
            if value is not None:
                return value
    return default


def _as_dict(row: Any) -> dict[str, Any]:
    if isinstance(row, dict):
        return dict(row)
    return {
        "id": _row_get(row, "id"),
        "node_id": _row_get(row, "node_id"),
        "publication_version": _row_get(row, "publication_version"),
        "contract_version": _row_get(row, "contract_version"),
        "response_policy": _row_get(row, "response_policy"),
        "content_kind": _row_get(row, "content_kind"),
        "content_manifest": _row_get(row, "content_manifest"),
        "manifest_hash": _row_get(row, "manifest_hash"),
        "contract_hash": _row_get(row, "contract_hash"),
        "knowledge_bundle_version_ref": _row_get(row, "knowledge_bundle_version_ref"),
        "knowledge_bundle_version_id": _row_get(row, "knowledge_bundle_version_id"),
        "user_id": _row_get(row, "user_id"),
        "business_id": _row_get(row, "business_id"),
        "bundle_id": _row_get(row, "bundle_id"),
        "version": _row_get(row, "version"),
        "status": _row_get(row, "status"),
        "items_manifest": _row_get(row, "items_manifest"),
        "bundle_hash": _row_get(row, "bundle_hash"),
        "owner_user_id": _row_get(row, "owner_user_id"),
        "access_scope": _row_get(row, "access_scope"),
        "created_by": _row_get(row, "created_by"),
    }


def verify_contract_integrity(publication: dict[str, Any]) -> None:
    """Recompute dual hashes; fail closed on mismatch."""
    try:
        manifest = pub.validate_manifest(publication["content_manifest"])
        manifest_hash = pub.compute_manifest_hash(manifest)
    except pub.YansiV2ContractError as exc:
        raise PublicationContextError(exc.code) from exc
    if manifest_hash != str(publication["manifest_hash"]).lower():
        raise PublicationContextError("contract_hash_mismatch")
    expected = pub.compute_contract_hash(
        node_id=str(publication["node_id"]),
        publication_version=int(publication["publication_version"]),
        response_policy=str(publication["response_policy"]),
        content_kind=str(publication["content_kind"]),
        manifest_hash=manifest_hash,
        knowledge_bundle_version_ref=publication.get("knowledge_bundle_version_ref"),
    )
    if expected != str(publication["contract_hash"]).lower():
        raise PublicationContextError("contract_hash_mismatch")


def filter_usage_items_with_live_digests(
    items: list[dict[str, Any]],
    *,
    business_id: str | None,
    owner_user_id: str,
    live_sources: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Keep usageAllowed items whose digests still match live content.

    Digest mismatch drops that item from the answer allowlist (fail-closed
    per source). Asset identity alone is never enough — live revision /
    locator binding or observation content digest must match.

    ``usageAllowed`` and ``viewAllowed`` stay distinct: a revoked public view
    demotes display without automatically discarding usage, unless the
    digest/tenant check itself fails.
    """
    kept: list[dict[str, Any]] = []
    dropped: list[str] = []
    for item in items:
        if not item.get("usageAllowed"):
            continue
        candidate = dict(item)
        # First pass: digest + tenant with view demoted so revoke-public does
        # not erase usage eligibility.
        usage_probe = {**candidate, "viewAllowed": False}
        try:
            kb.authorize_item_against_sources(
                usage_probe,
                business_id=business_id,
                owner_user_id=owner_user_id,
                sources=live_sources,
            )
        except kb.KnowledgeBundleError as exc:
            if exc.code in {
                "bundle_digest_mismatch",
                "bundle_foreign_source",
                "bundle_observation_not_ready",
                "bundle_provenance_invalid",
            }:
                dropped.append(
                    f"{item.get('sourceKind')}:{item.get('sourceRefId') or item.get('index')}:{exc.code}"
                )
                continue
            raise PublicationContextError(exc.code) from exc
        if candidate.get("viewAllowed"):
            try:
                kb.authorize_item_against_sources(
                    candidate,
                    business_id=business_id,
                    owner_user_id=owner_user_id,
                    sources=live_sources,
                )
            except kb.KnowledgeBundleError as exc:
                if exc.code == "bundle_view_not_permitted":
                    candidate = {**candidate, "viewAllowed": False}
                    dropped.append(
                        f"{item.get('sourceKind')}:{item.get('sourceRefId') or item.get('index')}:view_demoted"
                    )
                else:
                    dropped.append(
                        f"{item.get('sourceKind')}:{item.get('sourceRefId') or item.get('index')}:{exc.code}"
                    )
                    continue
        kept.append(candidate)
    return kept, dropped


def resolve_grounded_publication_context(
    *,
    publication_row: Any,
    node_row: Any,
    bundle_row: Any,
    bundle_version_row: Any,
    live_sources: dict[str, Any] | None = None,
    expected_contract_hash: str | None = None,
    expected_bundle_hash: str | None = None,
    expected_business_id: str | None = None,
    expected_owner_user_id: str | None = None,
) -> GroundedPublicationContext:
    """Build grounded context from server rows. Client expected_* values may
    only confirm the server identity — they cannot replace it.
    """
    publication = _as_dict(publication_row)
    node = _as_dict(node_row)
    bundle = _as_dict(bundle_row)
    bundle_version = _as_dict(bundle_version_row)

    node_id = _uuid_str(publication.get("node_id") or node.get("id"), "publication_node_mismatch")
    if _uuid_str(node.get("id"), "publication_node_mismatch") != node_id:
        raise PublicationContextError("publication_node_mismatch")

    policy = str(publication.get("response_policy") or "")
    if policy == "open":
        raise PublicationContextError("open_not_grounded")
    if policy != "grounded":
        raise PublicationContextError("invalid_response_policy")

    verify_contract_integrity(publication)

    contract_hash = str(publication["contract_hash"]).lower()
    if expected_contract_hash is not None and str(expected_contract_hash).lower() != contract_hash:
        raise PublicationContextError("contract_hash_mismatch")

    owner_user_id = _uuid_str(
        bundle.get("owner_user_id") or node.get("user_id"),
        "publication_owner_mismatch",
    )
    if expected_owner_user_id is not None and _uuid_str(expected_owner_user_id) != owner_user_id:
        raise PublicationContextError("publication_owner_mismatch")
    if node.get("user_id") is not None and _uuid_str(node["user_id"]) != owner_user_id:
        raise PublicationContextError("publication_owner_mismatch")

    business_raw = bundle.get("business_id")
    if business_raw is None:
        raise PublicationContextError("bundle_tenant_required")
    business_id = _uuid_str(business_raw, "bundle_tenant_required")
    if expected_business_id is not None and _uuid_str(expected_business_id) != business_id:
        raise PublicationContextError("bundle_tenant_mismatch")

    try:
        kb.assert_publication_bundle_binding(
            response_policy=policy,
            knowledge_bundle_version_ref=publication.get("knowledge_bundle_version_ref"),
            bundle_version={
                "id": bundle_version.get("id"),
                "bundleVersionId": bundle_version.get("id"),
                "status": bundle_version.get("status"),
                "bundle_hash": bundle_version.get("bundle_hash"),
                "bundleHash": bundle_version.get("bundle_hash"),
            },
        )
    except kb.KnowledgeBundleError as exc:
        raise PublicationContextError(exc.code) from exc
    fk = publication.get("knowledge_bundle_version_id")
    if fk is not None and _uuid_str(fk) != _uuid_str(bundle_version.get("id")):
        raise PublicationContextError("bundle_ref_mismatch")

    if str(bundle_version.get("status")) != "sealed":
        raise PublicationContextError("bundle_not_sealed")
    if _uuid_str(bundle_version.get("bundle_id")) != _uuid_str(bundle.get("id")):
        raise PublicationContextError("bundle_ref_mismatch")

    items = kb.validate_items_manifest(bundle_version.get("items_manifest") or [])
    bundle_hash = kb.compute_bundle_hash(items)
    stored_hash = str(bundle_version.get("bundle_hash") or "").lower()
    if bundle_hash != stored_hash:
        raise PublicationContextError("bundle_digest_mismatch")
    if expected_bundle_hash is not None and str(expected_bundle_hash).lower() != bundle_hash:
        raise PublicationContextError("bundle_digest_mismatch")

    live = live_sources or {}
    usage_items, dropped = filter_usage_items_with_live_digests(
        items,
        business_id=business_id,
        owner_user_id=owner_user_id,
        live_sources=live,
    )

    usage_kv: set[str] = set()
    view_kv: set[str] = set()
    usage_indexes: set[int] = set()
    view_indexes: set[int] = set()
    observation_indexes: set[int] = set()
    for item in usage_items:
        usage_indexes.add(int(item["index"]))
        if item.get("viewAllowed"):
            view_indexes.add(int(item["index"]))
        if item["sourceKind"] == "knowledge_version" and item.get("sourceRefId"):
            usage_kv.add(str(item["sourceRefId"]).lower())
            if item.get("viewAllowed"):
                view_kv.add(str(item["sourceRefId"]).lower())
        if item["sourceKind"] == "media_observation":
            observation_indexes.add(int(item["index"]))

    if not usage_items:
        raise PublicationContextError("bundle_usage_empty")

    return GroundedPublicationContext(
        node_id=node_id,
        publication_version=int(publication["publication_version"]),
        contract_hash=contract_hash,
        manifest_hash=str(publication["manifest_hash"]).lower(),
        response_policy=policy,
        content_kind=str(publication["content_kind"]),
        business_id=business_id,
        owner_user_id=owner_user_id,
        bundle_id=_uuid_str(bundle["id"]),
        bundle_version_id=_uuid_str(bundle_version["id"]),
        bundle_version_number=int(bundle_version["version"]),
        bundle_hash=bundle_hash,
        access_scope=str(bundle.get("access_scope") or "publication_bound"),
        items=tuple(usage_items),
        usage_knowledge_version_ids=frozenset(usage_kv),
        view_knowledge_version_ids=frozenset(view_kv),
        usage_item_indexes=frozenset(usage_indexes),
        view_item_indexes=frozenset(view_indexes),
        observation_item_indexes=frozenset(observation_indexes),
        dropped_digest_mismatches=tuple(dropped),
    )
