# -*- coding: utf-8 -*-
"""Mirror scene image generation — provider-agnostic types."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional


@dataclass(frozen=True)
class MirrorImageRequest:
    prompt: str
    negative_prompt: str
    seed_hint: str
    style_preset: str
    card_date: str
    quality_hints: List[str] = field(default_factory=list)
    """V5 minimal render contract — when set, provider prompt is passthrough."""
    prompt_contract: Optional[str] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class MirrorImageResult:
    scene_image_url: str
    provider: str
    cached: bool = False
    generated_at: str = field(default_factory=_utc_now_iso)


class MirrorImageProviderError(Exception):
    """Raised when a provider fails to generate a scene."""

    def __init__(
        self,
        message: str,
        *,
        source: str = "provider",
        http_status: int | None = None,
        diagnostic: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.source = source
        self.http_status = http_status
        self.diagnostic = diagnostic
