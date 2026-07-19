# -*- coding: utf-8 -*-
"""Production hardening — Director metadata allowlist + prepare cache scope."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from backend.core.schemas.mirror_director_metadata import MirrorDirectorMetadata
from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload
from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_director_metadata_sanitize import (
    sanitize_intelligence_private_for_persist,
    sanitize_mirror_director_metadata,
)
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import (
    cache_clear_for_tests,
    cache_get,
    cache_set,
)
from backend.services.mirror_network.public_payload import split_curiosity_payloads
from backend.services.mirror_network.fixtures import JAPAN_FIXTURE_BUNDLE


@pytest.fixture(autouse=True)
def _clear_cache():
    cache_clear_for_tests()
    yield
    cache_clear_for_tests()


def _msgs(*texts: str) -> list[MirrorConversationMessageDTO]:
    return [
        MirrorConversationMessageDTO(role="user", text=t, sequence=i)
        for i, t in enumerate(texts or ("Kyoto yağmur",))
    ]


def _draft_payload() -> dict:
    return {
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
        "forbiddenSymbols": ["bathroom mirror", "cosmetics"],
        "palette": ["warm amber", "deep indigo"],
        "composition": "street-level cinematic single scene",
        "lighting": "practical lantern light",
        "camera": "35mm eye-level",
        "typographyMood": "restrained editorial",
        "emotionalTone": ["curious", "calm"],
        "topicCategory": "travel",
        "confidence": 0.92,
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
                            "userIntent": "rainy evening",
                            "emotionalTone": ["calm"],
                            "narrative": "Rain softens Kyoto streets.",
                            "visualMotifs": ["lanterns"],
                            "forbiddenSymbols": ["bathroom mirror"],
                            "suggestedPalette": ["amber"],
                            "suggestedComposition": "street lanterns",
                            "confidence": 0.93,
                        }
                    )
                }
            }
        ]
    }


async def _ok_draft(_p):
    return {"choices": [{"message": {"content": json.dumps(_draft_payload())}}]}


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


def test_metadata_model_forbids_extra_fields():
    with pytest.raises(ValidationError):
        MirrorDirectorMetadata.model_validate(
            {
                "directorMode": "FULL",
                "prompt": "must not be accepted",
            }
        )


def test_sanitize_allowlist_and_drop_forbidden():
    sanitized = sanitize_mirror_director_metadata(
        {
            "directorMode": "FULL",
            "directorExecuted": True,
            "directorAffectedOutput": True,
            "draftSource": "llm_draft_approved",
            "titleSource": "llm_draft_approved",
            "promptSource": "director_v5_mapper",
            "directorDecision": "approve",
            "revisionCount": 0,
            "fallbackReason": None,
            "contentHash": "hash-abc",
            "directorReasonCodes": ["topic_mismatch"],
            "directorConfidence": 0.88,
            "totalDirectorDurationMs": 1200,
            "analysisSchemaVersion": "v1",
            "draftSchemaVersion": "v1",
            "reviewSchemaVersion": "v1",
            "draftModel": "gpt-4o-mini",
            "reviewModel": "gpt-4o-mini",
            # forbidden
            "prompt": "SECRET PROMPT",
            "messages": [{"role": "user", "text": "hi"}],
            "conversation": "raw",
            "providerResponse": {"choices": []},
            "evidence": "leak",
            "topicCategory": "travel",
            "analysisSource": "llm",
        }
    )
    assert sanitized is not None
    assert sanitized["directorMode"] == "FULL"
    assert sanitized["reasonCodes"] == ["topic_mismatch"]
    assert sanitized["confidence"] == 0.88
    assert sanitized["latency"] == 1200
    assert "prompt" not in sanitized
    assert "messages" not in sanitized
    assert "conversation" not in sanitized
    assert "providerResponse" not in sanitized
    assert "evidence" not in sanitized
    assert "topicCategory" not in sanitized
    assert "analysisSource" not in sanitized


def test_intelligence_private_sanitize_nested_and_extras():
    cleaned = sanitize_intelligence_private_for_persist(
        {
            "mirrorBody": "private body",
            "topicSummary": "travel",
            "evidenceLabels": ["Kyoto"],
            "prompt": "should drop",
            "intelligenceBrief": {
                "mirrorDirector": {
                    "directorMode": "SHADOW",
                    "directorExecuted": True,
                    "directorAffectedOutput": False,
                    "titleSource": "legacy_heuristic",
                    "promptSource": "legacy_heuristic",
                    "contentHash": "h1",
                    "snapshot": "NO",
                }
            },
        }
    )
    assert cleaned["mirrorBody"] == "private body"
    assert "prompt" not in cleaned
    director = cleaned["intelligenceBrief"]["mirrorDirector"]
    assert director["directorMode"] == "SHADOW"
    assert "snapshot" not in director


def test_split_curiosity_public_unchanged_private_director_allowlisted():
    public, private = split_curiosity_payloads(
        slug="sokak-lambalari-abc",
        card_title="Sokak Lambaları",
        card_date="2026-05-31",
        scene_image_url="https://cdn.example/scene.jpg",
        user_id="user-1",
        conversation_id="conv-1",
        curiosity_bundle=JAPAN_FIXTURE_BUNDLE,
        intelligence_private=sanitize_intelligence_private_for_persist(
            {
                "mirrorBody": "private",
                "topicSummary": "travel",
                "evidenceLabels": ["Kyoto"],
                "intelligenceBrief": {
                    "mirrorDirector": {
                        "directorMode": "FULL",
                        "directorExecuted": True,
                        "directorAffectedOutput": True,
                        "draftSource": "llm_draft_approved",
                        "titleSource": "llm_draft_approved",
                        "promptSource": "director_v5_mapper",
                        "contentHash": "abc",
                        "prompt": "DROP ME",
                    }
                },
            }
        ),
    )
    assert isinstance(public, MirrorNetworkPublicPayload)
    dumped_public = public.model_dump()
    assert "intelligenceBrief" not in dumped_public
    assert "mirrorDirector" not in json.dumps(dumped_public)
    brief = private.intelligenceBrief or {}
    director = brief.get("mirrorDirector") or {}
    assert director.get("directorMode") == "FULL"
    assert "prompt" not in director
    assert private.mirrorBody == "private"


def test_cache_mode_mismatch_miss():
    cache_set(
        "req-same0001",
        {"directorMode": "FULL", "usedDirector": True},
        director_mode="FULL",
        content_hash="hash-a",
        scope_key="user:1",
    )
    assert (
        cache_get(
            "req-same0001",
            director_mode="SHADOW",
            content_hash="hash-a",
            scope_key="user:1",
        )
        is None
    )


def test_cache_content_hash_mismatch_miss():
    cache_set(
        "req-same0002",
        {"directorMode": "FULL", "usedDirector": True},
        director_mode="FULL",
        content_hash="hash-a",
        scope_key="user:1",
    )
    assert (
        cache_get(
            "req-same0002",
            director_mode="FULL",
            content_hash="hash-b",
            scope_key="user:1",
        )
        is None
    )


def test_cache_same_request_hit():
    cache_set(
        "req-same0003",
        {"directorMode": "FULL", "usedDirector": True, "contentHash": "hash-a"},
        director_mode="FULL",
        content_hash="hash-a",
        scope_key="user:1",
    )
    hit = cache_get(
        "req-same0003",
        director_mode="FULL",
        content_hash="hash-a",
        scope_key="user:1",
    )
    assert hit is not None
    assert hit["usedDirector"] is True


def test_cache_scope_mismatch_miss():
    cache_set(
        "req-same0004",
        {"directorMode": "FULL"},
        director_mode="FULL",
        content_hash="hash-a",
        scope_key="user:1",
    )
    assert (
        cache_get(
            "req-same0004",
            director_mode="FULL",
            content_hash="hash-a",
            scope_key="user:2",
        )
        is None
    )


@pytest.mark.asyncio
async def test_prepare_cache_content_hash_mismatch_reruns(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    calls = {"n": 0}

    async def meaning_counting(payload):
        calls["n"] += 1
        return await _ok_meaning(payload)

    msgs_a = _msgs("Kyoto yağmur bir")
    first = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-hash0001",
        messages=msgs_a,
        scope_key="user:a",
        meaning_completer=meaning_counting,
        draft_completer=_ok_draft,
        review_completer=_ok_review,
    )
    assert first.reusedCache is False
    assert calls["n"] == 1

    second = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-hash0001",
        messages=_msgs("Tamamen farklı içerik iki"),
        scope_key="user:a",
        meaning_completer=meaning_counting,
        draft_completer=_ok_draft,
        review_completer=_ok_review,
    )
    assert second.reusedCache is False
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_coding_bug_falls_back_but_emits_visible_event(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    events: list[tuple[str, dict]] = []

    def _capture(event, **fields):
        events.append((event, fields))

    async def boom_orch(**_kwargs):
        raise AttributeError("simulated coding bug")

    with (
        patch(
            "backend.services.mirror.mirror_director_prepare.emit_director_event",
            side_effect=_capture,
        ),
        patch(
            "backend.services.mirror.mirror_director_prepare.run_mirror_director_orchestration",
            side_effect=boom_orch,
        ),
    ):
        out = await prepare_mirror_director_draft(
            conversation_id="c1",
            generation_request_id="req-bug00001",
            messages=_msgs("Kyoto"),
            scope_key="user:a",
            meaning_completer=_ok_meaning,
            draft_completer=_ok_draft,
            review_completer=_ok_review,
        )

    assert out.usedDirector is False
    assert out.applyTitle is False
    assert out.fallbackReason == "coding_bug"
    assert any(e[0] == "director_coding_bug" for e in events)
    bug = next(e for e in events if e[0] == "director_coding_bug")[1]
    assert bug.get("errorType") == "AttributeError"
