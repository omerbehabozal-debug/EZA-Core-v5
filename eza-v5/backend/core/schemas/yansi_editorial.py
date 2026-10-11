from typing import Literal
from pydantic import BaseModel, Field


class EditorialBlock(BaseModel):
    model_config = {"extra": "forbid"}
    type: Literal["markdown", "sectionHeading"]
    startOffset: int = Field(ge=0)
    endOffset: int = Field(gt=0)
    displayNumber: str | None = None


class EditorialStep(BaseModel):
    model_config = {"extra": "forbid"}
    stepIndex: int = Field(ge=1, le=8)
    questionHash: str
    answerHash: str
    blocks: list[EditorialBlock]


class PublicEditorialVersion(BaseModel):
    model_config = {"extra": "forbid"}
    slug: str
    journeyVersion: int
    language: Literal["und"]
    templateVersion: Literal[1]
    sourceHash: str
    offsetEncoding: Literal["utf-16"]
    status: Literal["pending", "processing", "ready", "failed"]
    steps: list[EditorialStep]
