"""Yansı V2 publication contract helpers.

Stage 1 security fix: validate, canonicalize, dual-hash, public DTO, version row shaping.
Does not open HTTP publish writers. Does not mutate V1 frozen hashes.

Hash authority (backend-only canonical definitions):
- manifestHash = SHA-256(canonical JSON of contentManifest)
- contractHash = SHA-256(canonical JSON of seal fields:
  nodeId, publicationVersion, responsePolicy, contentKind, manifestHash,
  knowledgeBundleVersionRef)
Clients must not redefine these algorithms.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from pydantic import ValidationError

from backend.core.schemas.yansi_v2_publication import (
    CONTRACT_VERSION,
    ContentManifest,
    FrozenConversationBlock,
    PublicationContractV2,
    WRITER_ASSET_AUTHORITY_RULE,
    assert_no_private_keys,
)

_PRIVATE_MEDIA_KEYS = frozenset({
    'storageKey', 'storage_key', 'objectKey', 'object_key', 'bucket',
    's3Key', 's3_key', 'absolutePath', 'absolute_path', 'filePath', 'file_path',
    'localPath', 'local_path', 'brandAssetPath', 'brand_asset_path',
    'locator', 'url', 'path', 'src', 'file', 'signedUrl', 'signed_url',
})


class YansiV2ContractError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def canonical_manifest_payload(manifest: ContentManifest | dict[str, Any]) -> dict[str, Any]:
    if isinstance(manifest, ContentManifest):
        return manifest.model_dump(mode='json')
    return ContentManifest.model_validate(manifest).model_dump(mode='json')


def compute_manifest_hash(manifest: ContentManifest | dict[str, Any]) -> str:
    return digest_text(canonical_json(canonical_manifest_payload(manifest)))


def contract_seal_payload(
    *,
    node_id: str,
    publication_version: int,
    response_policy: str,
    content_kind: str,
    manifest_hash: str,
    knowledge_bundle_version_ref: str | None,
) -> dict[str, Any]:
    return {
        'nodeId': str(node_id).lower(),
        'publicationVersion': int(publication_version),
        'responsePolicy': response_policy,
        'contentKind': content_kind,
        'manifestHash': manifest_hash,
        'knowledgeBundleVersionRef': knowledge_bundle_version_ref,
    }


def compute_contract_hash(
    *,
    node_id: str,
    publication_version: int,
    response_policy: str,
    content_kind: str,
    manifest_hash: str,
    knowledge_bundle_version_ref: str | None,
) -> str:
    return digest_text(canonical_json(contract_seal_payload(
        node_id=node_id,
        publication_version=publication_version,
        response_policy=response_policy,
        content_kind=content_kind,
        manifest_hash=manifest_hash,
        knowledge_bundle_version_ref=knowledge_bundle_version_ref,
    )))


def _map_validation_error(exc: ValidationError) -> str:
    message = str(exc)
    if 'grounded_requires_knowledge_bundle' in message:
        return 'yansi_v2_invalid_policy'
    if 'content_kind_mismatch' in message:
        return 'yansi_v2_content_kind_mismatch'
    if 'frozen_turn_order_invalid' in message:
        return 'yansi_v2_frozen_turn_order'
    if 'frozen_turn_empty' in message or 'frozen_turn_padding' in message:
        return 'yansi_v2_frozen_turn_empty'
    if 'private_or_invalid_media_path' in message or 'asset_path_mismatch' in message:
        return 'yansi_v2_private_media_path'
    if 'unsafe_url' in message:
        return 'yansi_v2_unsafe_url'
    if 'private_media_key' in message:
        return 'yansi_v2_private_media_key'
    if 'responsePolicy' in message or 'contentKind' in message or 'contractVersion' in message:
        return 'yansi_v2_invalid_policy'
    # Pydantic min/max_length on frozen turns surfaces as too_short / too_long.
    if 'frozen_conversation' in message and ('too_short' in message or 'too_long' in message):
        return 'yansi_v2_frozen_turn_count'
    if 'turns' in message and ('too_short' in message or 'too_long' in message):
        return 'yansi_v2_frozen_turn_count'
    return 'yansi_v2_invalid_contract'


def extract_frozen_conversation_block(
    manifest: ContentManifest | dict[str, Any],
) -> FrozenConversationBlock | None:
    """Return the sealed frozen_conversation block if present."""
    payload = canonical_manifest_payload(manifest)
    for block in payload.get('blocks') or []:
        if isinstance(block, dict) and block.get('type') == 'frozen_conversation':
            return FrozenConversationBlock.model_validate(block)
    return None


def curiosity_question_from_manifest(manifest: ContentManifest | dict[str, Any]) -> str | None:
    frozen = extract_frozen_conversation_block(manifest)
    if frozen is None:
        return None
    return frozen.curiosity_question


def validate_manifest(raw: Any) -> ContentManifest:
    try:
        assert_no_private_keys(raw)
        manifest = ContentManifest.model_validate(raw)
    except ValidationError as exc:
        raise YansiV2ContractError(_map_validation_error(exc)) from exc
    except ValueError as exc:
        if str(exc) == 'private_media_key':
            raise YansiV2ContractError('yansi_v2_private_media_key') from exc
        raise YansiV2ContractError('yansi_v2_invalid_block') from exc
    if not manifest.blocks:
        raise YansiV2ContractError('yansi_v2_empty_manifest')
    return manifest


def validate_contract(raw: Any, *, expect_hashes: bool = True) -> PublicationContractV2:
    if not isinstance(raw, dict):
        raise YansiV2ContractError('yansi_v2_invalid_contract')
    version = raw.get('contractVersion')
    if version is not None and version != CONTRACT_VERSION:
        raise YansiV2ContractError('yansi_v2_unknown_contract_version')
    try:
        assert_no_private_keys(raw)
        contract = PublicationContractV2.model_validate(raw)
    except ValidationError as exc:
        raise YansiV2ContractError(_map_validation_error(exc)) from exc
    except ValueError as exc:
        if str(exc) == 'private_media_key':
            raise YansiV2ContractError('yansi_v2_private_media_key') from exc
        raise YansiV2ContractError('yansi_v2_invalid_contract') from exc
    if expect_hashes:
        computed_manifest = compute_manifest_hash(contract.contentManifest)
        if contract.manifestHash != computed_manifest:
            raise YansiV2ContractError('yansi_v2_manifest_hash_mismatch')
        computed_contract = compute_contract_hash(
            node_id=contract.nodeId,
            publication_version=contract.publicationVersion,
            response_policy=contract.responsePolicy,
            content_kind=contract.contentKind,
            manifest_hash=contract.manifestHash,
            knowledge_bundle_version_ref=contract.knowledgeBundleVersionRef,
        )
        if contract.contractHash != computed_contract:
            raise YansiV2ContractError('yansi_v2_contract_hash_mismatch')
    return contract


def build_contract(
    *,
    node_id: str,
    response_policy: str,
    content_kind: str,
    content_manifest: dict[str, Any] | ContentManifest,
    publication_version: int,
    knowledge_bundle_version_ref: str | None = None,
    approval_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble a sealed V2 envelope with manifestHash + contractHash. No persistence."""
    if not isinstance(publication_version, int) or isinstance(publication_version, bool):
        raise YansiV2ContractError('yansi_v2_invalid_policy')
    manifest = validate_manifest(content_manifest)
    manifest_hash = compute_manifest_hash(manifest)
    contract_hash = compute_contract_hash(
        node_id=node_id,
        publication_version=publication_version,
        response_policy=response_policy,
        content_kind=content_kind,
        manifest_hash=manifest_hash,
        knowledge_bundle_version_ref=knowledge_bundle_version_ref,
    )
    payload = {
        'contractVersion': CONTRACT_VERSION,
        'nodeId': str(node_id).lower(),
        'responsePolicy': response_policy,
        'contentKind': content_kind,
        'contentManifest': manifest.model_dump(mode='json'),
        'manifestHash': manifest_hash,
        'contractHash': contract_hash,
        'knowledgeBundleVersionRef': knowledge_bundle_version_ref,
        'publicationVersion': publication_version,
        'approvalMetadata': approval_metadata,
    }
    return validate_contract(payload).model_dump(mode='json')


def version_row_from_contract(contract: dict[str, Any] | PublicationContractV2) -> dict[str, Any]:
    """Shape an immutable persistence row for yansi_publication_versions_v2 (no DB write)."""
    sealed = validate_contract(contract if isinstance(contract, dict) else contract.model_dump(mode='json'))
    return {
        'node_id': sealed.nodeId,
        'publication_version': sealed.publicationVersion,
        'contract_version': sealed.contractVersion,
        'response_policy': sealed.responsePolicy,
        'content_kind': sealed.contentKind,
        'content_manifest': sealed.contentManifest.model_dump(mode='json'),
        'manifest_hash': sealed.manifestHash,
        'contract_hash': sealed.contractHash,
        'knowledge_bundle_version_ref': sealed.knowledgeBundleVersionRef,
        'approval_metadata': (
            sealed.approvalMetadata.model_dump(mode='json') if sealed.approvalMetadata else None
        ),
    }


def _strip_private(value: Any) -> Any:
    if isinstance(value, list):
        return [_strip_private(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _strip_private(item)
            for key, item in value.items()
            if key not in _PRIVATE_MEDIA_KEYS
        }
    return value


def to_public_contract_dto(raw: Any) -> dict[str, Any]:
    """Public-safe V2 contract. Rejects unknown versions and private media keys."""
    contract = validate_contract(raw)
    public = contract.model_dump(mode='json')
    cleaned = _strip_private(public)
    assert_no_private_keys(cleaned)
    return cleaned


def is_v2_contract_marker(raw: Any) -> bool:
    return isinstance(raw, dict) and raw.get('contractVersion') == CONTRACT_VERSION


def has_explicit_contract_version(raw: Any) -> bool:
    return isinstance(raw, dict) and 'contractVersion' in raw


def parse_publication_payload(raw: Any) -> dict[str, Any] | None:
    """Return validated public V2 DTO, or None only for true legacy (no contractVersion).

    Explicit unknown/broken contractVersion raises — never downgraded to V1.
    """
    if not isinstance(raw, dict):
        return None
    if 'contractVersion' not in raw:
        return None
    if raw.get('contractVersion') != CONTRACT_VERSION:
        raise YansiV2ContractError('yansi_v2_unknown_contract_version')
    return to_public_contract_dto(raw)


# Re-export writer rule for Stage 2 documentation / tests.
ASSET_AUTHORITY_RULE = WRITER_ASSET_AUTHORITY_RULE
