# -*- coding: utf-8 -*-
"""PR C — prepare-director-draft production wiring tests."""

from __future__ import annotations

import json

import pytest

from backend.core.schemas.mirror_draft import MirrorDraft
from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import cache_clear_for_tests
from backend.services.mirror.mirror_draft_to_v5 import map_mirror_draft_to_v5_prompt
from backend.services.mirror.mirror_meaning_heuristic import build_heuristic_meaning_from_snapshot
from backend.services.mirror.conversation_snapshot import build_mirror_conversation_snapshot


@pytest.fixture(autouse=True)
def _clear_cache():
    cache_clear_for_tests()
    yield
    cache_clear_for_tests()


def _msgs(*texts: str) -> list[MirrorConversationMessageDTO]:
    out = []
    for i, t in enumerate(texts):
        out.append(MirrorConversationMessageDTO(role="user", text=t, sequence=i))
    return out


def _draft_payload(**overrides) -> dict:
    base = {
        "title": "Yağmur Altında Kyoto",
        "subtitle": None,
        "coreIdea": "Planı bozan yağmurun yolculuğun en değerli anına dönüşmesi.",
        "narrativeAngle": "unexpected_discovery",
        "artDirection": "night_discovery",
        "sceneDescription": (
            "Lantern-lit Kyoto street after rain, wet stone reflections, "
            "a warm tea-house glow spilling onto the pavement."
        ),
        "visualMotifs": ["rain on lanterns", "tea house glow"],
        "forbiddenSymbols": ["bathroom mirror", "cosmetics", "geisha"],
        "palette": ["warm amber", "deep indigo"],
        "composition": "street-level cinematic single scene",
        "lighting": "practical lantern light",
        "camera": "35mm eye-level",
        "typographyMood": "restrained editorial",
        "emotionalTone": ["curious", "calm"],
        "topicCategory": "travel",
        "confidence": 0.92,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_prepare_flag_off_zero_llm(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "LEGACY")
    called = {"n": 0}

    async def boom(_payload):
        called["n"] += 1
        raise AssertionError("LLM should not be called")

    result = await prepare_mirror_director_draft(
        conversation_id="chat-1",
        generation_request_id="req-abcdef12",
        messages=_msgs("Kyoto yağmur"),
        meaning_completer=boom,
        draft_completer=boom,
        review_completer=boom,
    )
    assert result.directorEnabled is False
    assert result.usedDirector is False
    assert result.directorMode == "LEGACY"
    assert called["n"] == 0


@pytest.mark.asyncio
async def test_prepare_flag_on_pipeline_and_cache(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")

    async def interpretation_ok(_p):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "title": "Yağmur Altında Kyoto",
                                "interpretationSummary": (
                                    "A Kyoto evening walk reshaped by rain and narrow streets."
                                ),
                                "rationale": (
                                    "User sought atmosphere over checklist tourism; rain and "
                                    "Pontocho leanings matter."
                                ),
                                "imageIntent": (
                                    "A stranger should feel a damp Kyoto evening street before rain."
                                ),
                                "visualNarrative": (
                                    "A narrow Pontocho-like lane at dusk, wet stone beginning to "
                                    "shine, warm lantern glow, a quiet café doorway ahead — one "
                                    "continuous natural moment, no collage."
                                ),
                                "exclusions": [
                                    "object collage",
                                    "geisha cliché",
                                    "poster typography",
                                    "readable signs",
                                ],
                                "confidence": 0.91,
                                "topicCategory": "travel",
                                "atmosphereHint": "humid dusk before rain",
                            }
                        )
                    }
                }
            ]
        }

    first = await prepare_mirror_director_draft(
        conversation_id="chat-kyoto",
        generation_request_id="req-kyoto0001",
        messages=_msgs(
            "Kyoto'da akşam yürüyüşü",
            "Yağmur yağarsa plan nasıl değişir?",
        ),
        scope_key="user:test-scope",
        interpretation_completer=interpretation_ok,
    )
    assert first.directorEnabled is True
    assert first.usedDirector is True
    assert first.mappedPrompt is not None
    assert first.mappedPrompt.title == "Yağmur Altında Kyoto"
    assert first.mappedPrompt.titleSource in {
        "interpretation_llm",
        "interpretation_heuristic",
    }
    assert first.finalInterpretation is not None
    assert first.conversationContext is not None
    assert first.conversationContext.creativeAuthority == "none"
    assert "TITLE:" not in first.mappedPrompt.prompt
    assert f'"{first.mappedPrompt.title}"' not in first.mappedPrompt.prompt
    assert "no text" in first.mappedPrompt.prompt.lower()
    assert "VISUAL NARRATIVE" in first.mappedPrompt.prompt
    assert first.metadata is not None
    assert first.contentHash
    assert first.applyPrompt is True

    second = await prepare_mirror_director_draft(
        conversation_id="chat-kyoto",
        generation_request_id="req-kyoto0001",
        messages=_msgs(
            "Kyoto'da akşam yürüyüşü",
            "Yağmur yağarsa plan nasıl değişir?",
        ),
        scope_key="user:test-scope",
        interpretation_completer=interpretation_ok,
    )
    assert second.reusedCache is True
    assert second.mappedPrompt is not None
    assert second.mappedPrompt.title == first.mappedPrompt.title


def test_v5_mapper_title_authority_and_bounds():
    draft = MirrorDraft.model_validate(_draft_payload())
    mapped = map_mirror_draft_to_v5_prompt(
        draft, title_source="llm_draft_approved", art_direction_source="llm_draft"
    )
    assert mapped.title == "Yağmur Altında Kyoto"
    assert mapped.titleSource == "llm_draft_approved"
    assert mapped.season == "night_discovery"
    assert len(mapped.prompt) <= 1400
    assert mapped.promptContract == "saina_mirror_v5_minimal"
    assert "TITLE:" not in mapped.prompt
    assert f'"{mapped.title}"' not in mapped.prompt
    assert "Create a natural cinematic scene with no text" in mapped.prompt


def test_heuristic_meaning_travel_and_health():
    snap = build_mirror_conversation_snapshot(
        user_messages=["Kyoto'da yağmurlu akşam", "Gion mi?"]
    )
    m = build_heuristic_meaning_from_snapshot(snap)
    assert m.primaryTopic == "travel"

    snap2 = build_mirror_conversation_snapshot(
        user_messages=["Her gün 10 bin adım", "Kalori yakmak istiyorum"]
    )
    m2 = build_heuristic_meaning_from_snapshot(snap2)
    assert m2.primaryTopic == "health"


def test_prepare_service_never_imports_quota():
    import backend.services.mirror.mirror_director_prepare as prep
    import inspect

    src = inspect.getsource(prep)
    assert "consume_usage_event_atomic" not in src
    assert "generate_mirror_scene" not in src
