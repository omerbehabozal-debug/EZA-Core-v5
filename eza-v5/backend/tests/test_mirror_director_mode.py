# -*- coding: utf-8 -*-
"""PR C — Director rollout mode resolver + execution policy tests."""

from __future__ import annotations

import json

import pytest

from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_director_mode import (
    get_mirror_director_execution_policy,
    resolve_mirror_director_mode,
)
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import cache_clear_for_tests


@pytest.fixture(autouse=True)
def _clear(monkeypatch):
    cache_clear_for_tests()
    monkeypatch.delenv("EZA_MIRROR_DIRECTOR_MODE", raising=False)
    monkeypatch.delenv("EZA_MIRROR_DIRECTOR_ENABLED", raising=False)
    yield
    cache_clear_for_tests()


def test_resolver_defaults_to_legacy(monkeypatch):
    monkeypatch.setattr(
        "backend.services.mirror.mirror_director_mode.get_settings",
        lambda: type("S", (), {"EZA_MIRROR_DIRECTOR_MODE": "", "EZA_MIRROR_DIRECTOR_ENABLED": False})(),
    )
    assert resolve_mirror_director_mode() == "LEGACY"


def test_resolver_enabled_true_maps_to_full(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_ENABLED", "true")
    assert resolve_mirror_director_mode() == "FULL"


def test_resolver_enabled_false_maps_to_legacy(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_ENABLED", "false")
    assert resolve_mirror_director_mode() == "LEGACY"


@pytest.mark.parametrize("mode", ["LEGACY", "SHADOW", "SOFT", "FULL"])
def test_resolver_mode_env(monkeypatch, mode):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", mode)
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_ENABLED", "false")  # MODE wins
    assert resolve_mirror_director_mode() == mode


def test_resolver_invalid_mode_legacy(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "PERCENT_50")
    assert resolve_mirror_director_mode() == "LEGACY"


def test_mode_overrides_boolean(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "SHADOW")
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_ENABLED", "true")
    assert resolve_mirror_director_mode() == "SHADOW"


def test_execution_policies():
    legacy = get_mirror_director_execution_policy("LEGACY")
    assert legacy.run_director_pipeline is False
    assert legacy.affect_user_output is False

    shadow = get_mirror_director_execution_policy("SHADOW")
    assert shadow.run_director_pipeline is True
    assert shadow.use_director_title is False
    assert shadow.use_director_prompt is False
    assert shadow.affect_user_output is False

    soft = get_mirror_director_execution_policy("SOFT")
    assert soft.use_director_title is True
    assert soft.use_director_prompt is False
    assert soft.affect_user_output is True

    full = get_mirror_director_execution_policy("FULL")
    assert full.use_director_title is True
    assert full.use_director_prompt is True
    assert full.affect_user_output is True


def _msgs():
    return [
        MirrorConversationMessageDTO(role="user", text="Kyoto'da yağmurlu akşam", sequence=0),
        MirrorConversationMessageDTO(role="user", text="Gion mi Pontocho mu?", sequence=1),
    ]


def _draft_json():
    return {
        "title": "Yağmur Altında Kyoto",
        "coreIdea": "Rain becomes the best part of the Kyoto plan.",
        "narrativeAngle": "unexpected_discovery",
        "artDirection": "night_discovery",
        "sceneDescription": "Lantern-lit Kyoto street after rain with wet stone reflections.",
        "visualMotifs": ["lanterns", "rain"],
        "forbiddenSymbols": ["bathroom mirror"],
        "palette": ["amber", "indigo"],
        "composition": "street-level cinematic scene",
        "lighting": "lantern practicals",
        "camera": "35mm eye-level",
        "typographyMood": "restrained editorial",
        "emotionalTone": ["calm"],
        "topicCategory": "travel",
        "confidence": 0.9,
    }


async def _ok_meaning(_p):
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "primaryTopic": "travel",
                            "topicCategory": "travel",
                            "secondaryTopics": ["Kyoto"],
                            "userIntent": "rain plan",
                            "emotionalTone": ["calm"],
                            "narrative": "Rain softens Kyoto evenings.",
                            "visualMotifs": ["lanterns"],
                            "forbiddenSymbols": ["bathroom mirror"],
                            "suggestedPalette": ["amber"],
                            "suggestedComposition": "street-level lantern reflections at dusk",
                            "confidence": 0.93,
                        }
                    )
                }
            }
        ]
    }


async def _ok_draft(_p):
    return {"choices": [{"message": {"content": json.dumps(_draft_json())}}]}


async def _ok_review(_p):
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "decision": "approve",
                            "overallScore": 0.9,
                            "reasonCodes": [],
                            "summary": "ok",
                            "requiredChanges": [],
                            "revisedDraft": None,
                            "confidence": 0.9,
                        }
                    )
                }
            }
        ]
    }


@pytest.mark.asyncio
async def test_legacy_no_provider_calls(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "LEGACY")
    called = {"n": 0}

    async def boom(_p):
        called["n"] += 1
        raise AssertionError("no LLM")

    out = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-legacy01",
        messages=_msgs(),
        meaning_completer=boom,
        draft_completer=boom,
        review_completer=boom,
    )
    assert out.directorMode == "LEGACY"
    assert out.directorExecuted is False
    assert out.applyTitle is False
    assert out.applyPrompt is False
    assert out.titleSource == "legacy_heuristic"
    assert called["n"] == 0


@pytest.mark.asyncio
async def test_shadow_runs_but_does_not_affect_output(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "SHADOW")
    out = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-shadow01",
        messages=_msgs(),
        meaning_completer=_ok_meaning,
        draft_completer=_ok_draft,
        review_completer=_ok_review,
    )
    assert out.directorMode == "SHADOW"
    assert out.directorExecuted is True
    assert out.directorAffectedOutput is False
    assert out.applyTitle is False
    assert out.applyPrompt is False
    assert out.mappedPrompt is None
    assert out.shadowMappedPrompt is not None
    assert out.titleSource == "legacy_heuristic"
    assert out.promptSource == "legacy_heuristic"


@pytest.mark.asyncio
async def test_soft_title_only(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "SOFT")
    out = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-soft0001",
        messages=_msgs(),
        meaning_completer=_ok_meaning,
        draft_completer=_ok_draft,
        review_completer=_ok_review,
    )
    assert out.directorMode == "SOFT"
    assert out.applyTitle is True
    assert out.applyPrompt is False
    assert out.mappedPrompt is not None
    assert out.titleSource != "legacy_heuristic"
    assert out.promptSource == "legacy_heuristic"


@pytest.mark.asyncio
async def test_full_title_and_prompt(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    out = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-full0001",
        messages=_msgs(),
        meaning_completer=_ok_meaning,
        draft_completer=_ok_draft,
        review_completer=_ok_review,
    )
    assert out.directorMode == "FULL"
    assert out.applyTitle is True
    assert out.applyPrompt is True
    assert out.mappedPrompt is not None
    assert out.promptSource == "director_v5_mapper"


@pytest.mark.asyncio
async def test_prepare_never_quota(monkeypatch):
    import inspect
    import backend.services.mirror.mirror_director_prepare as prep

    assert "consume_usage_event_atomic" not in inspect.getsource(prep)
