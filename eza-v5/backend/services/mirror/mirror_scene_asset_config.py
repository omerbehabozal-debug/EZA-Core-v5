# -*- coding: utf-8 -*-
"""Production startup validation for mirror deploy (scene assets + OpenAI provider)."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

from backend.config import Settings, get_settings


class MirrorSceneAssetConfigError(RuntimeError):
    """Raised when production mirror deploy configuration is invalid."""


def is_production_environment(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    env_lower = (settings.ENV or "").lower()
    eza_lower = (settings.EZA_ENV or "").lower() if settings.EZA_ENV else ""
    return env_lower in ("prod", "production") or eza_lower in ("prod", "production")


def has_production_deploy_intent(settings: Settings) -> bool:
    """Detect prod-like config without ENV=prod (validation bypass guard)."""
    if (getattr(settings, "EZA_MIRROR_SCENE_ASSET_BASE_URL", None) or "").strip():
        return True
    provider = (getattr(settings, "EZA_MIRROR_IMAGE_PROVIDER", None) or "").strip().lower()
    api_key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
    return provider == "openai" and bool(api_key)


def default_mirror_scene_asset_dir() -> Path:
    backend_dir = Path(__file__).resolve().parents[2]
    return backend_dir / "data" / "mirror_scene_assets"


def collect_mirror_scene_asset_config_errors(settings: Settings | None = None) -> list[str]:
    """Return human-readable config errors. Empty list means valid."""
    settings = settings or get_settings()
    prod_marked = is_production_environment(settings)
    prod_intent = prod_marked or has_production_deploy_intent(settings)
    if not prod_intent:
        return []

    errors: list[str] = []

    if not prod_marked:
        errors.append(
            "ENV or EZA_ENV must be explicitly set to prod (or production). "
            "Production mirror configuration was detected without a production env flag."
        )

    if prod_marked:
        provider = (settings.EZA_MIRROR_IMAGE_PROVIDER or "mock").strip().lower()
        if provider != "openai":
            errors.append(
                "EZA_MIRROR_IMAGE_PROVIDER must be openai in production "
                f"(got {provider!r})."
            )

        if not (settings.OPENAI_API_KEY or "").strip():
            errors.append("OPENAI_API_KEY is required in production.")

    base_url = (getattr(settings, "EZA_MIRROR_SCENE_ASSET_BASE_URL", None) or "").strip()
    if not base_url:
        errors.append(
            "EZA_MIRROR_SCENE_ASSET_BASE_URL is required in production "
            "(public HTTPS prefix for /api/public/mirror-scene-assets/{file})."
        )
    else:
        parsed = urlparse(base_url)
        if parsed.scheme != "https":
            errors.append(
                "EZA_MIRROR_SCENE_ASSET_BASE_URL must use https:// in production "
                f"(got scheme={parsed.scheme or 'missing'})."
            )
        if not parsed.netloc:
            errors.append(
                "EZA_MIRROR_SCENE_ASSET_BASE_URL must include a host "
                f"(example: https://api.ezacore.ai)."
            )

    configured_dir = (getattr(settings, "EZA_MIRROR_SCENE_ASSET_DIR", None) or "").strip()
    if not configured_dir:
        default_dir = default_mirror_scene_asset_dir()
        errors.append(
            "EZA_MIRROR_SCENE_ASSET_DIR must be set explicitly in production "
            f"(default ephemeral path {default_dir} is not allowed)."
        )
    else:
        resolved = Path(configured_dir).expanduser()
        if resolved == default_mirror_scene_asset_dir().resolve():
            errors.append(
                "EZA_MIRROR_SCENE_ASSET_DIR must point to a persistent volume mount, "
                "not the container-local default backend/data/mirror_scene_assets path."
            )

    return errors


def format_mirror_scene_asset_config_errors(errors: Iterable[str]) -> str:
    lines = ["Production mirror deploy configuration is invalid:"]
    lines.extend(f"  - {item}" for item in errors)
    lines.append(
        "Set ENV=prod (or EZA_ENV=prod), EZA_MIRROR_IMAGE_PROVIDER=openai, OPENAI_API_KEY, "
        "EZA_MIRROR_SCENE_ASSET_BASE_URL=https://<api-host>, and "
        "EZA_MIRROR_SCENE_ASSET_DIR=/data/mirror_scene_assets on a Railway persistent volume."
    )
    return "\n".join(lines)


def validate_mirror_scene_asset_startup_config(settings: Settings | None = None) -> None:
    """Fail fast on production misconfiguration."""
    errors = collect_mirror_scene_asset_config_errors(settings)
    if errors:
        raise MirrorSceneAssetConfigError(format_mirror_scene_asset_config_errors(errors))
