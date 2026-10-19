"""Studio admission and opt-in extractive AI generation contracts."""
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

PROMPT_VERSION = 'business-studio-extractive-v1'
State = Literal['blocked', 'pending', 'running', 'validated', 'succeeded', 'failed', 'cancelled', 'expired', 'queued', 'completed']


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class TopicsRequest(Strict):
    idempotencyKey: str = Field(min_length=8, max_length=128, pattern=r'^[a-zA-Z0-9_.:-]+$')
    sourceVersionIds: list[UUID] = Field(min_length=1, max_length=16)
    topicHint: str = Field(default='', max_length=500)

    @field_validator('sourceVersionIds')
    @classmethod
    def distinct_sources(cls, values):
        if len(values) != len(set(values)):
            raise ValueError('duplicate_source_version')
        return sorted(values, key=str)


class GenerationRequest(TopicsRequest):
    expectedSnapshotHash: str = Field(pattern=r'^[0-9a-f]{64}$')
    topicsGenerationId: UUID | None = None
    topicId: str | None = Field(default=None, min_length=1, max_length=80)


class SourceIdentity(Strict):
    versionId: UUID
    version: int
    contentHash: str


class GenerationResponse(Strict):
    generationId: UUID
    businessId: UUID
    kind: Literal['topics', 'draft']
    status: State
    executionAvailable: bool = False
    result: dict | None = None
    usageEstimated: bool = False
    snapshotHash: str
    sources: list[SourceIdentity]
    model: str | None
    promptVersion: str
    attemptCount: int
    maxAttempts: int
    reservedInputTokens: int
    reservedOutputTokens: int
    inputTokens: int
    outputTokens: int
    costUsd: Decimal
    costLimitUsd: Decimal
    currency: Literal['USD'] = 'USD'
    errorCode: str | None
    draftId: UUID | None
    createdAt: datetime
    updatedAt: datetime


class Evidence(Strict):
    # Evidence must preserve source whitespace for exact offset/hash validation.
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    versionId: UUID
    version: int = Field(ge=1)
    contentHash: str = Field(pattern=r'^[0-9a-f]{64}$')
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=4000)
    passageHash: str = Field(pattern=r'^[0-9a-f]{64}$')
    offsetEncoding: Literal['unicode-codepoint'] = 'unicode-codepoint'


class ValidatedStep(Strict):
    question: str = Field(min_length=1, max_length=1000)
    answer: str = Field(min_length=1, max_length=4000)
    evidence: Evidence


class DraftCandidate(Strict):
    # Extractive v1: headings and summary must also have source support.
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=500)
    metadataEvidence: list[Evidence] = Field(min_length=1, max_length=4)
    steps: list[ValidatedStep] = Field(min_length=8, max_length=8)
