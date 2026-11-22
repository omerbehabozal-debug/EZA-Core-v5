"""Yansı Knowledge Bundle Stage 2A — seal, authorize, public DTO. No HTTP / retrieval."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from backend.core.schemas.yansi_knowledge_bundle import (
    BUNDLE_SCHEMA_VERSION,
    BundleItem,
    BundleItemsManifest,
    BundleVersionEnvelope,
)

_PRIVATE_KEYS = frozenset({
    'storageKey', 'storage_key', 'objectKey', 'object_key', 'bucket',
    's3Key', 's3_key', 'absolutePath', 'absolute_path', 'filePath', 'file_path',
    'localPath', 'local_path', 'brandAssetPath', 'brand_asset_path',
    'locator', 'url', 'path', 'src', 'file', 'signedUrl', 'signed_url', 'content',
})
_UUID = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.I,
)


class KnowledgeBundleError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest_text(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _uuid(value: Any) -> str:
    text = str(value).lower()
    if not _UUID.match(text):
        raise KnowledgeBundleError('bundle_invalid_id')
    return text


def _forbid_private(value: Any) -> None:
    if isinstance(value, dict):
        if _PRIVATE_KEYS.intersection(value):
            raise KnowledgeBundleError('bundle_private_field')
        for item in value.values():
            _forbid_private(item)
    elif isinstance(value, list):
        for item in value:
            _forbid_private(item)


def compute_creator_text_digest(text: str) -> str:
    if not isinstance(text, str) or not text or len(text) > 8000:
        raise KnowledgeBundleError('bundle_invalid_text')
    return digest_text(text)


def compute_knowledge_digest(content: str) -> str:
    if not isinstance(content, str):
        raise KnowledgeBundleError('bundle_digest_mismatch')
    return digest_text(content)


def compute_asset_digest(*, asset_id: str, revision: int, asset_type: str, locator_kind: str | None, locator: str | None) -> str:
    """Pin asset identity without exposing locator in public DTOs."""
    return digest_text(canonical_json({
        'assetId': _uuid(asset_id),
        'revision': int(revision),
        'assetType': asset_type,
        'locatorKind': locator_kind,
        'locator': locator,
    }))


def compute_bundle_hash(items: list[dict[str, Any]]) -> str:
    ordered = sorted(items, key=lambda row: row['index'])
    return digest_text(canonical_json({'items': ordered}))


def validate_items_manifest(raw: Any) -> list[dict[str, Any]]:
    try:
        _forbid_private(raw)
        manifest = BundleItemsManifest.model_validate({'items': raw} if isinstance(raw, list) else raw)
    except ValidationError as exc:
        raise KnowledgeBundleError('bundle_invalid_items') from exc
    indexes = [item.index for item in manifest.items]
    if indexes != list(range(len(indexes))):
        raise KnowledgeBundleError('bundle_invalid_item_index')
    return [item.model_dump(mode='json') for item in manifest.items]


def authorize_item_against_sources(
    item: dict[str, Any],
    *,
    business_id: str | None,
    owner_user_id: str,
    sources: dict[str, Any],
) -> dict[str, Any]:
    """Validate tenant ownership and pin digests. `sources` holds loaded rows by kind.

    Expected keys in sources (optional):
      knowledge_versions[id] -> {business_id, content, version, title, public_allowed}
      assets[id] -> {business_id, asset_type, revision, locator_kind, locator, public_allowed, title}
      observations[id] -> {business_id, asset_id, content_sha256, analyzer_profile, status}
    """
    kind = item['sourceKind']
    if kind == 'creator_text':
        text = item.get('text') or ''
        digest = compute_creator_text_digest(text)
        if item['contentDigest'] != digest:
            raise KnowledgeBundleError('bundle_digest_mismatch')
        if item['provenanceType'] != 'creator':
            raise KnowledgeBundleError('bundle_provenance_invalid')
        return item

    if business_id is None:
        raise KnowledgeBundleError('bundle_tenant_required')

    if kind == 'knowledge_version':
        row = (sources.get('knowledge_versions') or {}).get(item['sourceRefId'])
        if row is None or str(row['business_id']).lower() != business_id.lower():
            raise KnowledgeBundleError('bundle_foreign_source')
        digest = compute_knowledge_digest(row['content'])
        if item['contentDigest'] != digest:
            raise KnowledgeBundleError('bundle_digest_mismatch')
        if int(row['version']) != int(item['knowledgeVersion']):
            raise KnowledgeBundleError('bundle_digest_mismatch')
        # Usage may include private knowledge; view only when public_allowed.
        if item['viewAllowed'] and not row.get('public_allowed'):
            raise KnowledgeBundleError('bundle_view_not_permitted')
        if item.get('text') is not None:
            raise KnowledgeBundleError('bundle_private_field')
        return {
            **item,
            'title': item.get('title') or row.get('title'),
        }

    if kind in {'image_asset', 'video_asset'}:
        row = (sources.get('assets') or {}).get(item['sourceRefId'])
        expected = 'image' if kind == 'image_asset' else 'video'
        if row is None or str(row['business_id']).lower() != business_id.lower():
            raise KnowledgeBundleError('bundle_foreign_source')
        if row.get('asset_type') != expected:
            raise KnowledgeBundleError('bundle_foreign_source')
        digest = compute_asset_digest(
            asset_id=item['sourceRefId'],
            revision=int(row['revision']),
            asset_type=row['asset_type'],
            locator_kind=row.get('locator_kind'),
            locator=row.get('locator'),
        )
        if item['contentDigest'] != digest:
            raise KnowledgeBundleError('bundle_digest_mismatch')
        if item['viewAllowed'] and not row.get('public_allowed'):
            raise KnowledgeBundleError('bundle_view_not_permitted')
        return {**item, 'title': item.get('title') or row.get('title')}

    if kind == 'media_observation':
        row = (sources.get('observations') or {}).get(item['observationId'])
        if row is None or str(row['business_id']).lower() != business_id.lower():
            raise KnowledgeBundleError('bundle_foreign_source')
        if str(row['asset_id']).lower() != str(item['sourceRefId']).lower():
            raise KnowledgeBundleError('bundle_foreign_source')
        if row.get('status') != 'ready':
            raise KnowledgeBundleError('bundle_observation_not_ready')
        if row.get('content_sha256') != item['contentDigest']:
            raise KnowledgeBundleError('bundle_digest_mismatch')
        if row.get('analyzer_profile') != item.get('analyzerProfile'):
            raise KnowledgeBundleError('bundle_provenance_invalid')
        # AI notes are provenance for usage; never force public view of raw tags.
        if item['viewAllowed'] and item.get('text'):
            raise KnowledgeBundleError('bundle_private_field')
        return item

    raise KnowledgeBundleError('bundle_invalid_items')


def build_authorized_manifest(
    items: list[dict[str, Any]],
    *,
    business_id: str | None,
    owner_user_id: str,
    sources: dict[str, Any],
) -> tuple[list[dict[str, Any]], str]:
    validated = validate_items_manifest(items)
    authorized = [
        authorize_item_against_sources(
            item,
            business_id=business_id,
            owner_user_id=owner_user_id,
            sources=sources,
        )
        for item in validated
    ]
    # Re-validate after authorization fills titles / coherence.
    sealed_items = validate_items_manifest(authorized)
    return sealed_items, compute_bundle_hash(sealed_items)


def assert_draft_mutable(status: str) -> None:
    if status != 'draft':
        raise KnowledgeBundleError('bundle_immutable')


def seal_version_payload(
    *,
    bundle_id: str,
    bundle_version_id: str,
    version: int,
    access_scope: str,
    items: list[dict[str, Any]],
    bundle_hash: str,
    business_id: str | None,
    owner_user_id: str,
    approved_by: str | None = None,
) -> dict[str, Any]:
    if bundle_hash != compute_bundle_hash(items):
        raise KnowledgeBundleError('bundle_digest_mismatch')
    payload = {
        'schemaVersion': BUNDLE_SCHEMA_VERSION,
        'bundleId': _uuid(bundle_id),
        'bundleVersionId': _uuid(bundle_version_id),
        'version': int(version),
        'status': 'sealed',
        'accessScope': access_scope,
        'bundleHash': bundle_hash,
        'items': items,
        'businessId': _uuid(business_id) if business_id else None,
        'ownerUserId': _uuid(owner_user_id),
        'approvedBy': _uuid(approved_by) if approved_by else None,
        'sealedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    }
    try:
        BundleVersionEnvelope.model_validate({
            key: payload[key]
            for key in (
                'schemaVersion', 'bundleId', 'bundleVersionId', 'version', 'status',
                'accessScope', 'bundleHash', 'items', 'businessId', 'ownerUserId',
            )
        })
    except ValidationError as exc:
        raise KnowledgeBundleError('bundle_invalid_items') from exc
    return payload


def to_public_bundle_dto(envelope: dict[str, Any]) -> dict[str, Any]:
    """Strip non-viewable text and all private media fields."""
    _forbid_private(envelope)
    try:
        parsed = BundleVersionEnvelope.model_validate({
            key: envelope[key]
            for key in (
                'schemaVersion', 'bundleId', 'bundleVersionId', 'version', 'status',
                'accessScope', 'bundleHash', 'items', 'businessId', 'ownerUserId',
            )
            if key in envelope
        })
    except ValidationError as exc:
        raise KnowledgeBundleError('bundle_invalid_items') from exc
    public_items = []
    for item in parsed.items:
        row = item.model_dump(mode='json')
        if not row['viewAllowed']:
            row.pop('text', None)
        # Keep digests + refs for audit; never locators / storage keys.
        for key in list(row):
            if key in _PRIVATE_KEYS:
                row.pop(key, None)
        public_items.append(row)
    return {
        'schemaVersion': parsed.schemaVersion,
        'bundleId': parsed.bundleId,
        'bundleVersionId': parsed.bundleVersionId,
        'version': parsed.version,
        'status': parsed.status,
        'accessScope': parsed.accessScope,
        'bundleHash': parsed.bundleHash,
        'businessId': parsed.businessId,
        'ownerUserId': parsed.ownerUserId,
        'items': public_items,
    }


def assert_publication_bundle_binding(
    *,
    response_policy: str,
    knowledge_bundle_version_ref: str | None,
    bundle_version: dict[str, Any] | None,
) -> None:
    """Grounded publications require a sealed bundle; open may omit one."""
    if response_policy == 'open':
        return
    if response_policy != 'grounded':
        raise KnowledgeBundleError('bundle_invalid_policy')
    if not knowledge_bundle_version_ref:
        raise KnowledgeBundleError('bundle_required_for_grounded')
    if bundle_version is None:
        raise KnowledgeBundleError('bundle_not_found')
    if str(bundle_version.get('id') or bundle_version.get('bundleVersionId') or '').lower() != str(
        knowledge_bundle_version_ref
    ).lower():
        raise KnowledgeBundleError('bundle_ref_mismatch')
    if bundle_version.get('status') != 'sealed':
        raise KnowledgeBundleError('bundle_not_sealed')
    if not bundle_version.get('bundle_hash') and not bundle_version.get('bundleHash'):
        raise KnowledgeBundleError('bundle_digest_mismatch')


def next_version_number(existing_versions: list[int]) -> int:
    return (max(existing_versions) if existing_versions else 0) + 1


def copy_items_for_new_version(previous_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Start a new draft from a prior sealed snapshot (caller must re-authorize)."""
    return validate_items_manifest(copy_deep(previous_items))


def copy_deep(value: Any) -> Any:
    return json.loads(json.dumps(value))
