"""Yansı Knowledge Bundle v1 schemas — Stage 2A. No retrieval / HTTP writers."""
from __future__ import annotations

from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

BUNDLE_SCHEMA_VERSION = 'yansi-knowledge-bundle-v1'
SourceKind = Literal[
    'creator_text',
    'knowledge_version',
    'image_asset',
    'video_asset',
    'media_observation',
]
ProvenanceType = Literal[
    'creator',
    'business_knowledge',
    'brand_asset',
    'ai_observation',
]
AccessScope = Literal['private', 'business', 'publication_bound']
BundleStatus = Literal['draft', 'sealed']
Sha256Hex = Annotated[str, StringConstraints(pattern=r'^[0-9a-f]{64}$')]
UuidStr = Annotated[
    str,
    StringConstraints(
        pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        min_length=36,
        max_length=36,
    ),
]


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class BundleItem(Strict):
    index: int = Field(ge=0, le=10_000)
    sourceKind: SourceKind
    provenanceType: ProvenanceType
    contentDigest: Sha256Hex
    usageAllowed: bool
    viewAllowed: bool
    sourceRefId: UuidStr | None = None
    # Optional public-safe labels only (never locators / storage keys / raw private text unless viewAllowed).
    title: Annotated[str, StringConstraints(min_length=1, max_length=200, strip_whitespace=False)] | None = None
    text: Annotated[str, StringConstraints(min_length=1, max_length=8000, strip_whitespace=False)] | None = None
    analyzerProfile: Annotated[str, StringConstraints(min_length=1, max_length=64, strip_whitespace=False)] | None = None
    observationId: UuidStr | None = None
    knowledgeVersion: int | None = Field(default=None, ge=1)

    @model_validator(mode='after')
    def coherence(self):
        if self.sourceKind == 'creator_text':
            if self.sourceRefId is not None:
                raise ValueError('creator_text_no_ref')
            if self.provenanceType != 'creator':
                raise ValueError('provenance_mismatch')
        elif self.sourceKind == 'knowledge_version':
            if self.sourceRefId is None or self.knowledgeVersion is None:
                raise ValueError('knowledge_ref_required')
            if self.provenanceType != 'business_knowledge':
                raise ValueError('provenance_mismatch')
        elif self.sourceKind in {'image_asset', 'video_asset'}:
            if self.sourceRefId is None:
                raise ValueError('asset_ref_required')
            if self.provenanceType != 'brand_asset':
                raise ValueError('provenance_mismatch')
        elif self.sourceKind == 'media_observation':
            if self.sourceRefId is None or self.observationId is None or not self.analyzerProfile:
                raise ValueError('observation_ref_required')
            if self.provenanceType != 'ai_observation':
                raise ValueError('provenance_mismatch')
        if self.sourceKind == 'creator_text' and not self.text:
            raise ValueError('creator_text_required')
        # Non-creator kinds must never embed raw body text in the sealed item.
        if self.sourceKind != 'creator_text' and self.text is not None:
            raise ValueError('private_text_leak')
        return self


class BundleItemsManifest(Strict):
    items: list[BundleItem] = Field(min_length=1, max_length=64)


class BundleVersionEnvelope(Strict):
    schemaVersion: Literal['yansi-knowledge-bundle-v1'] = BUNDLE_SCHEMA_VERSION
    bundleId: UuidStr
    bundleVersionId: UuidStr
    version: int = Field(ge=1, le=1_000_000)
    status: BundleStatus
    accessScope: AccessScope
    bundleHash: Sha256Hex
    items: list[BundleItem] = Field(min_length=1, max_length=64)
    businessId: UuidStr | None = None
    ownerUserId: UuidStr
