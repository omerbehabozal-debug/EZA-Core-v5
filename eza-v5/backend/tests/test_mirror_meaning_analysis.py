# -*- coding: utf-8 -*-
"""PR A — Mirror Meaning Analysis schema, snapshot, and isolated service."""

from __future__ import annotations

import json

import pytest

from backend.core.schemas.mirror_director import (
    MirrorMeaningAnalysis,
    normalize_mirror_director_topic,
)
from backend.services.mirror.conversation_snapshot import (
    assert_snapshot_has_no_private_keys,
    build_mirror_conversation_snapshot,
    snapshot_to_model_input,
)
from backend.services.mirror.mirror_meaning_analysis import (
    MirrorMeaningProviderSignal,
    analyze_mirror_meaning,
    parse_meaning_analysis_payload,
)
from backend.services.mirror import mirror_meaning_analysis as meaning_mod


def test_normalize_topic_aliases():
    assert normalize_mirror_director_topic("Travel") == "travel"
    assert normalize_mirror_director_topic("japan_travel") == "travel"
    assert normalize_mirror_director_topic("urbanism") == "architecture"
    assert normalize_mirror_director_topic("wellness") == "health"
    assert normalize_mirror_director_topic("weird_xyz") == "other"


def test_schema_accepts_controlled_topics():
    analysis = MirrorMeaningAnalysis.model_validate(
        {
            "primaryTopic": "travel",
            "topicCategory": "travel",
            "secondaryTopics": ["Kyoto", "rainy evening"],
            "userIntent": "find an enjoyable alternative plan for a rainy evening",
            "emotionalTone": ["curious", "calm"],
            "narrative": "Rain changes the expected route but reveals a quieter Kyoto.",
            "visualMotifs": ["rain on lantern-lit streets"],
            "forbiddenSymbols": ["bathroom mirror", "cosmetics"],
            "suggestedPalette": ["warm amber", "deep indigo"],
            "suggestedComposition": "cinematic street-level scene with reflected lights",
            "confidence": 0.96,
        }
    )
    assert analysis.schemaVersion == "mirror-director-v1"
    assert analysis.primaryTopic == "travel"
    assert analysis.topicCategory == "travel"


def test_schema_coerces_alias_primary_topic():
    analysis = MirrorMeaningAnalysis.model_validate(
        {
            "primaryTopic": "tourism",
            "topicCategory": "tourism",
            "userIntent": "visit Rome on foot",
            "narrative": "Walking Rome's historic center.",
            "suggestedComposition": "street-level historic walk",
            "confidence": 0.9,
        }
    )
    assert analysis.primaryTopic == "travel"
    assert analysis.topicCategory == "travel"


def test_schema_rejects_missing_required():
    with pytest.raises(Exception):
        MirrorMeaningAnalysis.model_validate(
            {
                "primaryTopic": "travel",
                "topicCategory": "travel",
                "confidence": 0.9,
            }
        )


def test_snapshot_prefers_user_messages_and_caps():
    users = [f"user message number {i} " + ("x" * 80) for i in range(40)]
    snap = build_mirror_conversation_snapshot(
        title="Kyoto evening",
        user_messages=users,
        assistant_messages=["I can help with that." * 20],
        conversation_summary="travel chat",
        max_chars=2000,
        include_assistant=True,
    )
    assert snap.char_count <= 2000
    assert snap.truncated is True
    assert all(m.role in ("user", "assistant") for m in snap.messages)
    assert sum(1 for m in snap.messages if m.role == "user") >= 2


def test_snapshot_strips_empty_and_duplicates():
    snap = build_mirror_conversation_snapshot(
        user_messages=["Kyoto walk", "Kyoto walk", "  ", "Gion at night"],
    )
    texts = [m.text for m in snap.messages]
    assert texts == ["Kyoto walk", "Gion at night"]


def test_snapshot_model_input_has_no_private_metadata():
    snap = build_mirror_conversation_snapshot(
        title="Rainy Kyoto",
        user_messages=["Kyoto'da yağmurlu akşam", "Gion mi Pontocho mu?"],
    )
    payload = snapshot_to_model_input(snap)
    assert "userId" not in json.dumps(payload)
    assert_snapshot_has_no_private_keys(payload)
    # Explicitly ensure we never auto-inject archive fields
    assert set(payload.keys()) == {"title", "conversationSummary", "messages"}


@pytest.mark.asyncio
async def test_analyze_invalid_json_fallback_signal():
    async def bad_completer(_payload):
        return {"choices": [{"message": {"content": "not-json {"}}]}

    snap = build_mirror_conversation_snapshot(user_messages=["Roma'yı yürüyerek gezmek istiyorum."])
    result = await analyze_mirror_meaning(snap, completer=bad_completer)
    assert result.ok is False
    assert result.code == "invalid_json"


@pytest.mark.asyncio
async def test_analyze_timeout_signal():
    async def slow(_payload):
        raise meaning_mod.httpx.TimeoutException("timeout")

    snap = build_mirror_conversation_snapshot(user_messages=["test"])
    result = await analyze_mirror_meaning(snap, completer=slow)
    assert result.ok is False
    assert result.code == "timeout"
    assert result.retryable is True


@pytest.mark.asyncio
async def test_analyze_429_signal():
    async def limited(_payload):
        raise MirrorMeaningProviderSignal("rate_limit", "429", retryable=True)

    snap = build_mirror_conversation_snapshot(user_messages=["test"])
    result = await analyze_mirror_meaning(snap, completer=limited)
    assert result.ok is False
    assert result.code == "rate_limit"


@pytest.mark.asyncio
async def test_analyze_valid_structured_output():
    body = {
        "primaryTopic": "travel",
        "topicCategory": "travel",
        "secondaryTopics": ["Kyoto", "rain"],
        "userIntent": "plan a rainy evening in Kyoto",
        "emotionalTone": ["curious", "calm"],
        "narrative": "Rain softens Kyoto's evening streets.",
        "visualMotifs": ["lantern glow", "wet stone"],
        "forbiddenSymbols": ["bathroom mirror", "cosmetics"],
        "suggestedPalette": ["warm amber", "indigo"],
        "suggestedComposition": "street-level lantern reflections",
        "confidence": 0.94,
    }

    async def good(_payload):
        return {"choices": [{"message": {"content": json.dumps(body)}}]}

    snap = build_mirror_conversation_snapshot(
        user_messages=[
            "Kyoto'da akşam yürüyüşü yapmak istiyorum.",
            "Yağmur yağarsa plan nasıl değişir?",
        ]
    )
    result = await analyze_mirror_meaning(snap, completer=good)
    assert result.ok is True
    assert result.analysis.primaryTopic == "travel"
    assert result.belowConfidenceThreshold is False
    assert "bathroom mirror" in result.analysis.forbiddenSymbols


@pytest.mark.asyncio
async def test_analyze_low_confidence_flag_keeps_analysis():
    body = {
        "primaryTopic": "health",
        "topicCategory": "health",
        "userIntent": "unclear",
        "narrative": "Unclear walk intent.",
        "suggestedComposition": "generic path",
        "confidence": 0.41,
        "secondaryTopics": [],
        "emotionalTone": [],
        "visualMotifs": [],
        "forbiddenSymbols": [],
        "suggestedPalette": [],
    }

    async def low(_payload):
        return {"choices": [{"message": {"content": json.dumps(body)}}]}

    snap = build_mirror_conversation_snapshot(user_messages=["yürüyüş"])
    result = await analyze_mirror_meaning(snap, completer=low)
    assert result.ok is True
    assert result.belowConfidenceThreshold is True
    assert result.analysis.confidence == 0.41


@pytest.mark.asyncio
async def test_empty_snapshot_failure():
    snap = build_mirror_conversation_snapshot(user_messages=[])
    result = await analyze_mirror_meaning(snap, completer=lambda _p: None)  # type: ignore[arg-type, return-value]
    assert result.ok is False
    assert result.code == "empty_snapshot"


def test_parse_meaning_analysis_payload_alias():
    parsed = parse_meaning_analysis_payload(
        {
            "primaryTopic": "urbanism",
            "userIntent": "design walkways",
            "narrative": "Sidewalk width and pedestrian axis.",
            "suggestedComposition": "urban plan view",
            "confidence": 0.88,
        }
    )
    assert parsed.primaryTopic == "architecture"
    assert parsed.topicCategory == "architecture"
