"""Map Yansı V2 service errors to safe HTTP responses."""
from __future__ import annotations

from fastapi import HTTPException

from backend.services.yansi.conversation_draft_v2 import ConversationDraftV2Error
from backend.services.yansi.publish_conversation_v2 import ConversationPublishV2Error
from backend.services.yansi.publish_image_v2 import ImagePublishV2Error
from backend.services.yansi.publication_context import PublicationContextError
from backend.services.yansi.public_projection import PublicProjectionError
from backend.services.yansi.public_read import PublicReadError

_PUBLISH_STATUS = {
    "owner_required": 403,
    "editor_required": 403,
    "membership_required": 403,
    "inactive_account": 401,
    "business_not_found": 404,
    "draft_not_found": 404,
    "asset_not_found": 404,
    "node_not_found": 404,
    "foreign_tenant_asset": 403,
    "foreign_tenant_knowledge": 403,
    "asset_not_image": 422,
    "asset_type_mismatch": 422,
    "asset_not_published": 409,
    "asset_not_public": 409,
    "asset_not_approved": 409,
    "asset_locator_invalid": 409,
    "video_media_https_required": 422,
    "revision_conflict": 409,
    "duplicate_publish": 409,
    "slug_taken": 409,
    "node_owner_mismatch": 403,
    "invalid_title": 422,
    "invalid_summary": 422,
    "invalid_idempotency_key": 422,
    "invalid_cover_asset": 422,
    "invalid_turns": 422,
    "turns_too_few": 422,
    "turns_too_many": 422,
    "frozen_turn_empty": 422,
    "frozen_turn_padding": 422,
    "frozen_turn_order_invalid": 422,
    "frozen_turn_too_long": 422,
    "invalid_turn_media": 422,
    "too_many_turn_media": 422,
    "description_too_long": 422,
    "invalid_knowledge_notes": 422,
    "too_many_knowledge_notes": 422,
    "knowledge_note_too_long": 422,
    "invalid_knowledge_sources": 422,
    "too_many_knowledge_sources": 422,
    "duplicate_knowledge_source": 422,
    "knowledge_source_not_found": 404,
    "knowledge_source_not_ready": 409,
    "knowledge_source_empty": 422,
    "bundle_too_large": 422,
    "bundle_digest_mismatch": 409,
    "bundle_not_found": 409,
    "bundle_not_sealed": 409,
    "bundle_usage_empty": 409,
    "approval_required": 409,
    "approval_stale": 409,
    "content_digest_mismatch": 409,
    "invalid_transition": 409,
    "draft_immutable": 409,
    "use_publish_service": 400,
    "studio_generation_not_found": 404,
    "proposal_not_ready": 409,
    "studio_insufficient_sources": 422,
    "studio_curiosity_mismatch": 422,
    "studio_turn_order_invalid": 422,
}

_READ_STATUS = {
    "publication_not_found": 404,
    "node_not_found": 404,
    "not_public": 404,
    "draft_not_readable": 404,
    "contract_hash_mismatch": 409,
    "bundle_not_sealed": 404,
    "bundle_not_found": 404,
    "public_manifest_invalid": 500,
    "public_asset_mismatch": 500,
    "public_media_path_invalid": 500,
}


def raise_publish_http(exc: BaseException) -> None:
    if isinstance(
        exc,
        (ImagePublishV2Error, ConversationPublishV2Error, ConversationDraftV2Error),
    ):
        raise HTTPException(
            _PUBLISH_STATUS.get(exc.code, 400),
            detail={"code": exc.code},
        ) from exc
    if isinstance(exc, (PublicationContextError, PublicProjectionError, PublicReadError)):
        raise HTTPException(
            _READ_STATUS.get(exc.code, 400),
            detail={"code": exc.code},
        ) from exc
    raise exc


def raise_draft_http(exc: BaseException) -> None:
    if isinstance(exc, (ConversationDraftV2Error, ConversationPublishV2Error)):
        raise HTTPException(
            _PUBLISH_STATUS.get(exc.code, 400),
            detail={"code": exc.code},
        ) from exc
    raise exc


def raise_read_http(exc: BaseException) -> None:
    if isinstance(
        exc,
        (
            PublicationContextError,
            PublicProjectionError,
            ImagePublishV2Error,
            ConversationPublishV2Error,
            PublicReadError,
        ),
    ):
        code = getattr(exc, "code", "publication_invalid")
        raise HTTPException(
            _READ_STATUS.get(code, _PUBLISH_STATUS.get(code, 400)),
            detail={"code": code},
        ) from exc
    raise exc
