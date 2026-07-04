# -*- coding: utf-8 -*-
"""Tests for mirror scene asset production startup validation."""

from __future__ import annotations

import pytest

from backend.config import Settings, get_settings
from backend.services.mirror.mirror_scene_asset_config import (
    MirrorSceneAssetConfigError,
    collect_mirror_scene_asset_config_errors,
    default_mirror_scene_asset_dir,
    has_production_deploy_intent,
    is_production_environment,
    validate_mirror_scene_asset_startup_config,
)


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _prod_settings(**overrides) -> Settings:
    base = {
        "ENV": "prod",
        "EZA_ENV": "prod",
        "EZA_MIRROR_IMAGE_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-test-key",
        "EZA_MIRROR_SCENE_ASSET_BASE_URL": "https://api.test.eza.ai",
        "EZA_MIRROR_SCENE_ASSET_DIR": "/data/mirror_scene_assets",
    }
    base.update(overrides)
    return Settings(**base)


def test_is_production_environment_detects_prod():
    assert is_production_environment(_prod_settings()) is True
    assert is_production_environment(Settings(ENV="ci", EZA_ENV="ci")) is False


def test_has_production_deploy_intent_detects_openai_without_prod_env():
    settings = Settings(
        ENV="dev",
        EZA_MIRROR_IMAGE_PROVIDER="openai",
        OPENAI_API_KEY="sk-test",
    )
    assert has_production_deploy_intent(settings) is True


def test_collect_errors_empty_in_non_production():
    settings = Settings(
        ENV="dev",
        EZA_ENV="dev",
        EZA_MIRROR_IMAGE_PROVIDER="mock",
        OPENAI_API_KEY=None,
        EZA_MIRROR_SCENE_ASSET_BASE_URL=None,
    )
    assert collect_mirror_scene_asset_config_errors(settings) == []


def test_collect_errors_requires_prod_env_when_openai_configured():
    errors = collect_mirror_scene_asset_config_errors(
        Settings(
            ENV="dev",
            EZA_MIRROR_IMAGE_PROVIDER="openai",
            OPENAI_API_KEY="sk-test",
            EZA_MIRROR_SCENE_ASSET_BASE_URL="https://api.test.eza.ai",
            EZA_MIRROR_SCENE_ASSET_DIR="/data/mirror_scene_assets",
        )
    )
    assert any("ENV or EZA_ENV must be explicitly set to prod" in item for item in errors)


def test_collect_errors_requires_openai_provider_in_production():
    errors = collect_mirror_scene_asset_config_errors(
        _prod_settings(EZA_MIRROR_IMAGE_PROVIDER="mock")
    )
    assert any("EZA_MIRROR_IMAGE_PROVIDER must be openai" in item for item in errors)


def test_collect_errors_requires_openai_api_key_in_production():
    errors = collect_mirror_scene_asset_config_errors(_prod_settings(OPENAI_API_KEY=None))
    assert any("OPENAI_API_KEY is required" in item for item in errors)


def test_collect_errors_requires_https_base_url_in_production():
    errors = collect_mirror_scene_asset_config_errors(
        _prod_settings(EZA_MIRROR_SCENE_ASSET_BASE_URL="http://api.test.eza.ai")
    )
    assert any("https://" in item for item in errors)


def test_collect_errors_requires_base_url_in_production():
    errors = collect_mirror_scene_asset_config_errors(
        _prod_settings(EZA_MIRROR_SCENE_ASSET_BASE_URL=None)
    )
    assert any("EZA_MIRROR_SCENE_ASSET_BASE_URL" in item for item in errors)


def test_collect_errors_requires_explicit_asset_dir_in_production():
    errors = collect_mirror_scene_asset_config_errors(
        _prod_settings(EZA_MIRROR_SCENE_ASSET_DIR=None)
    )
    assert any("EZA_MIRROR_SCENE_ASSET_DIR" in item for item in errors)


def test_collect_errors_rejects_default_asset_dir_path_in_production():
    default_dir = str(default_mirror_scene_asset_dir())
    errors = collect_mirror_scene_asset_config_errors(
        _prod_settings(EZA_MIRROR_SCENE_ASSET_DIR=default_dir)
    )
    assert any("persistent volume" in item for item in errors)


def test_collect_errors_passes_with_valid_production_config():
    assert collect_mirror_scene_asset_config_errors(_prod_settings()) == []


def test_validate_startup_raises_on_production_misconfig():
    with pytest.raises(MirrorSceneAssetConfigError) as exc:
        validate_mirror_scene_asset_startup_config(
            _prod_settings(EZA_MIRROR_SCENE_ASSET_BASE_URL=None)
        )
    assert "EZA_MIRROR_SCENE_ASSET_BASE_URL" in str(exc.value)


def test_validate_startup_passes_in_ci_without_prod_vars():
    validate_mirror_scene_asset_startup_config(
        Settings(
            ENV="ci",
            EZA_ENV="ci",
            EZA_MIRROR_IMAGE_PROVIDER="mock",
            OPENAI_API_KEY=None,
            EZA_MIRROR_SCENE_ASSET_BASE_URL=None,
        )
    )
