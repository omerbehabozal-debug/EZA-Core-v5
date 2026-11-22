"""Yansı publication contract v2 — schemas only. No I/O or publish writers.

Hash authority: backend `compute_manifest_hash` / `compute_contract_hash` are
canonical. Clients may display hashes but must not redefine them.
"""
from __future__ import annotations

import re
from typing import Annotated, Literal, Union
from urllib.parse import urlsplit
import ipaddress

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

CONTRACT_VERSION = 'yansi-publication-v2'
ResponsePolicy = Literal['open', 'grounded']
ContentKind = Literal['conversation', 'image', 'video', 'mixed']

MAX_BLOCKS = 32
MAX_TURNS = 64
MAX_FROZEN_TURNS = 8
MIN_FROZEN_TURNS = 1
MAX_TURN_MEDIA = 4
MAX_TURN_TEXT = 8000
MAX_TITLE = 200
MAX_ASSET_ID = 36
MAX_NOTE = 500
MAX_BUNDLE_REF = 128
MAX_APPROVER = 128
MAX_HTTPS = 1000

UuidStr = Annotated[str, StringConstraints(pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', min_length=36, max_length=36)]
Sha256Hex = Annotated[str, StringConstraints(pattern=r'^[0-9a-f]{64}$')]
# Sealed payloads must arrive clean — no silent strip/truncate at parse time.
TurnText = Annotated[str, StringConstraints(min_length=1, max_length=MAX_TURN_TEXT, strip_whitespace=False)]
TitleText = Annotated[str, StringConstraints(min_length=1, max_length=MAX_TITLE, strip_whitespace=False)]

_PUBLIC_IMAGE = re.compile(
    r'^/api/business-yansi/public-media/'
    r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
    r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$',
    re.IGNORECASE,
)
_BLOCKED_HOSTS = frozenset({'localhost', 'metadata.google.internal'})
_PRIVATE_MEDIA_KEYS = frozenset({
    'storageKey', 'storage_key', 'objectKey', 'object_key', 'bucket',
    's3Key', 's3_key', 'absolutePath', 'absolute_path', 'filePath', 'file_path',
    'localPath', 'local_path', 'brandAssetPath', 'brand_asset_path',
    'locator', 'url', 'path', 'src', 'file', 'signedUrl', 'signed_url',
})


def assert_no_private_keys(value: object) -> object:
    if isinstance(value, dict):
        if _PRIVATE_MEDIA_KEYS.intersection(value):
            raise ValueError('private_media_key')
        for item in value.values():
            assert_no_private_keys(item)
    elif isinstance(value, list):
        for item in value:
            assert_no_private_keys(item)
    return value


def validate_safe_https_url(value: str) -> str:
    """Match Business brand_assets https rules (no credentials / private hosts / bad schemes)."""
    if not isinstance(value, str) or not value or len(value) > MAX_HTTPS:
        raise ValueError('unsafe_url')
    if any(ord(ch) < 33 or ord(ch) == 127 for ch in value):
        raise ValueError('unsafe_url')
    lowered = value.lower()
    if '\\' in value or lowered.startswith(('javascript:', 'data:', 'blob:', 'file:', 'http:')):
        raise ValueError('unsafe_url')
    parts = urlsplit(value)
    host = (parts.hostname or '').rstrip('.').lower()
    if (
        parts.scheme != 'https'
        or parts.username
        or parts.password
        or not host
        or parts.fragment
        or (parts.port not in (None, 443))
        or host in _BLOCKED_HOSTS
        or host.endswith('.local')
        or host.endswith('.localhost')
    ):
        raise ValueError('unsafe_url')
    try:
        host.encode('idna')
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    except UnicodeError as exc:
        raise ValueError('unsafe_url') from exc
    if ip is not None and (
        ip.is_private or ip.is_loopback or ip.is_link_local
        or ip.is_reserved or ip.is_multicast or ip.is_unspecified
    ):
        raise ValueError('unsafe_url')
    return value


SafeHttpsUrl = Annotated[str, AfterValidator(validate_safe_https_url)]


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ConversationTurn(Strict):
    role: Literal['user', 'assistant']
    text: TurnText


class ConversationBlock(Strict):
    """Legacy open-ended role turns (not the Business 1–8 frozen Yansı shape)."""

    type: Literal['conversation']
    turns: list[ConversationTurn] = Field(min_length=1, max_length=MAX_TURNS)


class FrozenTurnImageMedia(Strict):
    type: Literal['image']
    assetId: UuidStr
    title: TitleText
    contentPath: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    assetRevision: int = Field(ge=0, le=1_000_000)

    @model_validator(mode='after')
    def public_path_matches_asset(self):
        match = _PUBLIC_IMAGE.fullmatch(self.contentPath)
        if match is None:
            raise ValueError('private_or_invalid_media_path')
        if match.group(2).lower() != self.assetId.lower():
            raise ValueError('asset_path_mismatch')
        return self


class FrozenTurnVideoMedia(Strict):
    """Reference-only video media inside a frozen turn (no new video publish path)."""

    type: Literal['video']
    assetId: UuidStr
    title: TitleText
    href: SafeHttpsUrl
    assetRevision: int = Field(ge=0, le=1_000_000)


FrozenTurnMedia = Annotated[
    Union[FrozenTurnImageMedia, FrozenTurnVideoMedia],
    Field(discriminator='type'),
]


class FrozenYansiTurn(Strict):
    """One published Q/A pair. stepIndex is 1-based and contiguous."""

    stepIndex: int = Field(ge=1, le=MAX_FROZEN_TURNS)
    question: TurnText
    answer: TurnText
    media: list[FrozenTurnMedia] = Field(default_factory=list, max_length=MAX_TURN_MEDIA)


class FrozenConversationBlock(Strict):
    """Business V2 frozen Yansı conversation: 1–8 ordered Q/A turns.

    First turn.question is the Discover curiosity question (product rule).
    """

    type: Literal['frozen_conversation']
    turns: list[FrozenYansiTurn] = Field(
        min_length=MIN_FROZEN_TURNS,
        max_length=MAX_FROZEN_TURNS,
    )

    @model_validator(mode='after')
    def contiguous_steps(self):
        indexes = [turn.stepIndex for turn in self.turns]
        if indexes != list(range(1, len(self.turns) + 1)):
            raise ValueError('frozen_turn_order_invalid')
        for turn in self.turns:
            if not turn.question.strip() or not turn.answer.strip():
                raise ValueError('frozen_turn_empty')
            if turn.question != turn.question.strip() or turn.answer != turn.answer.strip():
                raise ValueError('frozen_turn_padding')
        return self

    @property
    def curiosity_question(self) -> str:
        return self.turns[0].question


class ImageBlock(Strict):
    type: Literal['image']
    assetId: UuidStr
    title: TitleText
    contentPath: Annotated[str, StringConstraints(min_length=1, max_length=500)]

    @model_validator(mode='after')
    def public_path_matches_asset(self):
        match = _PUBLIC_IMAGE.fullmatch(self.contentPath)
        if match is None:
            raise ValueError('private_or_invalid_media_path')
        if match.group(2).lower() != self.assetId.lower():
            raise ValueError('asset_path_mismatch')
        return self


class VideoBlock(Strict):
    type: Literal['video']
    assetId: UuidStr
    title: TitleText
    href: SafeHttpsUrl


ContentBlock = Annotated[
    Union[ConversationBlock, FrozenConversationBlock, ImageBlock, VideoBlock],
    Field(discriminator='type'),
]


class ContentManifest(Strict):
    blocks: list[ContentBlock] = Field(min_length=1, max_length=MAX_BLOCKS)


class ApprovalMetadata(Strict):
    approvedBy: Annotated[str, StringConstraints(min_length=1, max_length=MAX_APPROVER, strip_whitespace=False)] | None = None
    approvedAt: Annotated[str, StringConstraints(min_length=1, max_length=64, strip_whitespace=False)] | None = None
    note: Annotated[str, StringConstraints(max_length=MAX_NOTE, strip_whitespace=False)] | None = None


class PublicationContractV2(Strict):
    """Sealed public contract envelope. Writers must verify asset authority before persist."""

    contractVersion: Literal['yansi-publication-v2']
    nodeId: UuidStr
    responsePolicy: ResponsePolicy
    contentKind: ContentKind
    contentManifest: ContentManifest
    manifestHash: Sha256Hex
    contractHash: Sha256Hex
    knowledgeBundleVersionRef: Annotated[
        str, StringConstraints(min_length=1, max_length=MAX_BUNDLE_REF, strip_whitespace=False)
    ] | None = None
    publicationVersion: int = Field(ge=1, le=1_000_000)
    approvalMetadata: ApprovalMetadata | None = None

    @model_validator(mode='after')
    def policy_and_kind(self):
        assert_no_private_keys(self.model_dump(mode='json'))
        if not isinstance(self.publicationVersion, int) or isinstance(self.publicationVersion, bool):
            raise ValueError('publication_version_not_int')
        if self.responsePolicy == 'grounded' and not self.knowledgeBundleVersionRef:
            raise ValueError('grounded_requires_knowledge_bundle')
        types = {block.type for block in self.contentManifest.blocks}
        if self.contentKind == 'conversation' and types not in (
            {'conversation'},
            {'frozen_conversation'},
        ):
            raise ValueError('content_kind_mismatch')
        if self.contentKind == 'image' and types != {'image'}:
            raise ValueError('content_kind_mismatch')
        if self.contentKind == 'video' and types != {'video'}:
            raise ValueError('content_kind_mismatch')
        if self.contentKind == 'mixed' and len(types) < 2:
            raise ValueError('content_kind_mismatch')
        return self


# Future publish writer contract (Stage 2+): before sealing a version row,
# resolve each block.assetId to the authorized tenant asset and prove that
# image contentPath / video href address that same asset. Do not trust client paths alone.
WRITER_ASSET_AUTHORITY_RULE = (
    'Publish writers must verify assetId and media address belong to the same '
    'authorized entity before persisting a V2 publication version.'
)
