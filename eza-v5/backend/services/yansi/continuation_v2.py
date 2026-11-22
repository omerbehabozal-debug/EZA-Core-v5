"""Server-side Yansı V2 grounded continuation binding.

Clients may pass slug + publication version for lookup only. Bundle id,
response policy, and contract material are resolved from sealed server rows.
Invalid / unsealed / hash-mismatched publications fail closed.
"""
from __future__ import annotations

from typing import Any

from backend.services.yansi.grounded_v2 import run_yansi_v2_grounded_answer
from backend.services.yansi.public_read import PublicReadError, load_public_v2_rows
from backend.services.yansi.publication_context import (
    GroundedPublicationContext,
    PublicationContextError,
    resolve_grounded_publication_context,
)


class YansiV2History(list):
    """Continuation marker — distinct from V1 BusinessHistory / BusinessPublication."""

    def __init__(
        self,
        history,
        *,
        slug: str,
        publication_version: int,
        business_id: str,
        contract_hash: str,
    ):
        super().__init__(history or [])
        self.slug = slug
        self.publication_version = int(publication_version)
        self.business_id = business_id
        self.contract_hash = contract_hash
        # Intentionally no client-writable bundleId / responsePolicy fields.

    def __bool__(self) -> bool:
        return True


class ContinuationV2Error(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def reject_client_overrides(payload: dict[str, Any] | None) -> None:
    """Fail closed if the client tries to supply bundle / policy overrides."""
    if not payload:
        return
    forbidden = (
        "bundleId",
        "bundle_id",
        "bundleVersionId",
        "bundle_version_id",
        "knowledgeBundleVersionRef",
        "knowledge_bundle_version_ref",
        "responsePolicy",
        "response_policy",
        "contentManifest",
        "content_manifest",
        "contractHash",
        "contract_hash",
        "manifestHash",
        "manifest_hash",
    )
    for key in forbidden:
        if key in payload and payload[key] is not None:
            raise ContinuationV2Error("client_override_forbidden")


async def bind_yansi_v2_history(db, slug, version, history) -> YansiV2History | None:
    """Return a V2 history bind when a public sealed publication exists for slug/version.

    Returns None when the slug is not a public V2 publication so V1 callers keep
    their original history object unchanged.

    Stage 04E: ``version`` must be an explicit publication_version (>=1). Omitting
    it must not fall through to ``current_v2_publication_version``.
    """
    if version is None:
        return None
    try:
        pinned = int(version)
    except (TypeError, ValueError):
        return None
    if pinned < 1:
        return None
    try:
        node, publication, bundle, bundle_version = await load_public_v2_rows(
            db,
            slug=slug,
            publication_version=pinned,
        )
        context = resolve_grounded_publication_context(
            publication_row=publication,
            node_row=node,
            bundle_row=bundle,
            bundle_version_row=bundle_version,
            expected_contract_hash=publication.contract_hash,
        )
    except (PublicReadError, PublicationContextError):
        return None

    return YansiV2History(
        history,
        slug=node.slug,
        publication_version=publication.publication_version,
        business_id=context.business_id,
        contract_hash=context.contract_hash,
    )


async def resolve_server_context(
    db,
    history: YansiV2History,
    *,
    expected_contract_hash: str | None = None,
) -> GroundedPublicationContext:
    """Reload and verify publication context from server rows only."""
    try:
        node, publication, bundle, bundle_version = await load_public_v2_rows(
            db,
            slug=history.slug,
            publication_version=history.publication_version,
        )
        return resolve_grounded_publication_context(
            publication_row=publication,
            node_row=node,
            bundle_row=bundle,
            bundle_version_row=bundle_version,
            expected_contract_hash=expected_contract_hash or history.contract_hash,
            expected_business_id=history.business_id,
        )
    except PublicReadError as exc:
        raise ContinuationV2Error(exc.code) from exc
    except PublicationContextError as exc:
        raise ContinuationV2Error(exc.code) from exc


async def answer_yansi_v2_continuation(
    db,
    question: str,
    history: YansiV2History,
    *,
    provider=None,
    embedder=None,
    search_fn=None,
    authorize_fn=None,
    sibling_loader=None,
    lexical_only: bool = False,
    client_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reject_client_overrides(client_payload)
    context = await resolve_server_context(db, history)
    return await run_yansi_v2_grounded_answer(
        db,
        context=context,
        question=question,
        history=list(history),
        provider=provider,
        embedder=embedder,
        search_fn=search_fn,
        authorize_fn=authorize_fn,
        sibling_loader=sibling_loader,
        lexical_only=lexical_only,
    )
