# -*- coding: utf-8 -*-
"""Mirror scene image provider abstraction and factory."""

from abc import ABC, abstractmethod
import logging
import os
import re

from backend.config import get_settings
from backend.services.mirror.types import (
    MirrorImageProviderError,
    MirrorImageRequest,
    MirrorImageResult,
)

logger = logging.getLogger(__name__)

KNOWN_PROVIDERS = frozenset({"mock", "openai", "replicate", "stability"})


class MirrorImageProvider(ABC):
    @abstractmethod
    async def generate_scene(self, request: MirrorImageRequest) -> MirrorImageResult:
        """Generate a textless scene image URL from prompt metadata only."""


class MockMirrorImageProvider(MirrorImageProvider):
    """Deterministic demo URLs — no external image API."""

    def __init__(self, default_url: str | None = None) -> None:
        self._default_url = (default_url or "").strip() or (
            "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"
            "?auto=format&fit=crop&w=1080&h=1920&q=80"
        )

    async def generate_scene(self, request: MirrorImageRequest) -> MirrorImageResult:
        seed_slug = re.sub(r"[^a-zA-Z0-9_-]", "", request.seed_hint)[:48] or "eza-mirror"
        custom = os.getenv("EZA_MIRROR_MOCK_SCENE_URL", "").strip()
        if custom:
            url = custom
        else:
            url = f"https://picsum.photos/seed/{seed_slug}/1080/1920"
        return MirrorImageResult(
            scene_image_url=url,
            provider="mock",
            cached=False,
        )


def resolve_mirror_image_provider_name() -> str:
    settings = get_settings()
    raw = (
        os.getenv("EZA_MIRROR_IMAGE_PROVIDER", "").strip().lower()
        or (settings.EZA_MIRROR_IMAGE_PROVIDER or "mock").strip().lower()
    )
    if isinstance(raw, str):
        name = raw.strip().lower()
    else:
        name = "mock"
    return name if name in KNOWN_PROVIDERS else "mock"


def get_mirror_image_provider(provider_name: str | None = None) -> MirrorImageProvider:
    """Return provider implementation.

    Production: unknown / unimplemented providers and bare mock are refused
    when ENV marks production (see mirror_scene_asset_config).
    """
    from backend.services.mirror.mirror_scene_asset_config import is_production_environment

    name = (provider_name or resolve_mirror_image_provider_name()).strip().lower()
    prod = is_production_environment()

    if name not in KNOWN_PROVIDERS:
        if prod:
            raise MirrorImageProviderError(
                "Mirror image provider misconfigured for production.",
                source="config",
                diagnostic={"errorCode": "unknown_provider", "provider": name},
            )
        logger.warning("Unknown mirror image provider %r — using mock", name)
        name = "mock"

    if name == "mock":
        if prod:
            raise MirrorImageProviderError(
                "Mock mirror image provider is not allowed in production.",
                source="config",
                diagnostic={"errorCode": "mock_forbidden_in_production"},
            )
        return MockMirrorImageProvider()

    if name == "openai":
        from backend.services.mirror.providers.openai_provider import OpenAIMirrorImageProvider

        return OpenAIMirrorImageProvider()

    if prod:
        raise MirrorImageProviderError(
            f"Mirror image provider {name!r} is not implemented for production.",
            source="config",
            diagnostic={"errorCode": "provider_unimplemented", "provider": name},
        )
    logger.info("Mirror provider %r not implemented yet — using mock", name)
    return MockMirrorImageProvider()
