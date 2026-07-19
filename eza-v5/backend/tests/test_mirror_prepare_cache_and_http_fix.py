# -*- coding: utf-8 -*-
"""Benchmark-blocking fixes: prepare cache authority isolation + HTTP classification."""

from __future__ import annotations

import inspect
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.core.schemas.mirror_interpretation import MIRROR_INTERPRETATION_SCHEMA_VERSION
from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_conversation_context import (
    build_mirror_conversation_context_v1,
)
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import (
    build_prepare_cache_contract_fingerprint,
    cache_clear_for_tests,
    cache_get,
    cache_set,
)
from backend.services.mirror.mirror_draft_to_v5 import MIRROR_TEXT_FREE_SCENE_RULE
from backend.services.mirror.mirror_interpretation import generate_mirror_interpretation
from backend.services.mirror.mirror_interpretation_to_v5 import (
    MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION,
    map_interpretation_to_v5_prompt,
)
from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.services.mirror.mirror_meaning_analysis import _classify_http_error


@pytest.fixture(autouse=True)
def _clear(monkeypatch):
    cache_clear_for_tests()
    monkeypatch.delenv("EZA_MIRROR_INTERPRETATION_V1", raising=False)
    yield
    cache_clear_for_tests()


def _fp(**kwargs) -> str:
    return build_prepare_cache_contract_fingerprint(**kwargs)


def _msg(text: str = "Kyoto yağmur") -> list[MirrorConversationMessageDTO]:
    return [MirrorConversationMessageDTO(role="user", text=text, sequence=0)]


def _interp_json() -> dict:
    return {
        "title": "Yağmur Altında Kyoto",
        "interpretationSummary": "Kyoto evening reshaped by rain.",
        "rationale": "Atmosphere over checklist tourism.",
        "imageIntent": "Feel a damp Kyoto lane at dusk.",
        "visualNarrative": (
            "A narrow lantern-lit lane at dusk with wet stones "
            "and a quiet café doorway — one natural moment."
        ),
        "exclusions": ["object collage", "poster typography"],
        "confidence": 0.9,
        "topicCategory": "travel",
        "atmosphereHint": "humid dusk",
    }


async def _ok_interp(_p):
    return {"choices": [{"message": {"content": json.dumps(_interp_json())}}]}


# ── Cache isolation ──────────────────────────────────────────────────────────


def test_1_same_authority_version_cache_hit():
    fp = _fp(use_interpretation_v1=True)
    cache_set(
        "req-hit0001",
        {"usedDirector": True, "ok": 1},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp,
    )
    hit = cache_get(
        "req-hit0001",
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp,
    )
    assert hit is not None
    assert hit["ok"] == 1


def test_2_interpretation_enabled_then_disabled_miss():
    fp_on = _fp(use_interpretation_v1=True)
    fp_off = _fp(use_interpretation_v1=False)
    cache_set(
        "req-kill0001",
        {"path": "interpretation"},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_on,
    )
    assert (
        cache_get(
            "req-kill0001",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp_off,
        )
        is None
    )


def test_3_interpretation_disabled_then_enabled_miss():
    fp_off = _fp(use_interpretation_v1=False)
    fp_on = _fp(use_interpretation_v1=True)
    cache_set(
        "req-kill0002",
        {"path": "legacy"},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_off,
    )
    assert (
        cache_get(
            "req-kill0002",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp_on,
        )
        is None
    )


def test_4_legacy_vs_interpretation_isolated():
    fp_legacy = _fp(use_interpretation_v1=False)
    fp_interp = _fp(use_interpretation_v1=True)
    assert fp_legacy != fp_interp
    assert "authorityPath=legacy" in fp_legacy
    assert "authorityPath=interpretation-v1" in fp_interp
    cache_set(
        "req-iso0001",
        {"path": "legacy"},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_legacy,
    )
    cache_set(
        "req-iso0001",
        {"path": "interpretation"},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_interp,
    )
    # Last write wins for same request id; lookup with legacy must miss.
    assert (
        cache_get(
            "req-iso0001",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp_legacy,
        )
        is None
    )
    hit = cache_get(
        "req-iso0001",
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_interp,
    )
    assert hit is not None
    assert hit["path"] == "interpretation"


def test_5_schema_version_change_miss():
    fp_a = _fp(
        use_interpretation_v1=True,
        interpretation_version="mirror-interpretation-v1",
    )
    fp_b = _fp(
        use_interpretation_v1=True,
        interpretation_version="mirror-interpretation-v2",
    )
    cache_set(
        "req-schema01",
        {"v": 1},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_a,
    )
    assert (
        cache_get(
            "req-schema01",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp_b,
        )
        is None
    )


def test_6_mapper_version_change_miss():
    fp_a = _fp(
        use_interpretation_v1=True,
        mapper_version="interpretation-to-v5-v1",
    )
    fp_b = _fp(
        use_interpretation_v1=True,
        mapper_version="interpretation-to-v5-v2",
    )
    cache_set(
        "req-map0001",
        {"v": 1},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp_a,
    )
    assert (
        cache_get(
            "req-map0001",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp_b,
        )
        is None
    )


def test_7_director_mode_isolation_intact():
    fp = _fp(use_interpretation_v1=True)
    cache_set(
        "req-mode0001",
        {"mode": "FULL"},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:a",
        contract_fingerprint=fp,
    )
    assert (
        cache_get(
            "req-mode0001",
            director_mode="SOFT",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=fp,
        )
        is None
    )


def test_8_scope_isolation_intact():
    fp = _fp(use_interpretation_v1=True)
    cache_set(
        "req-scope001",
        {"scope": 1},
        director_mode="FULL",
        content_hash="h1",
        scope_key="user:1",
        contract_fingerprint=fp,
    )
    assert (
        cache_get(
            "req-scope001",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:2",
            contract_fingerprint=fp,
        )
        is None
    )


def test_9_fingerprint_metadata_only_no_conversation():
    fp = _fp(use_interpretation_v1=True)
    assert "Kyoto" not in fp
    assert "yağmur" not in fp
    assert MIRROR_INTERPRETATION_SCHEMA_VERSION in fp
    assert MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION in fp
    assert "useInterpretationV1=true" in fp


def test_old_envelope_without_fingerprint_is_miss():
    """No unsafe migration: pre-contract entries are unreachable."""
    from backend.services.mirror import mirror_director_prepare_cache as mod

    with mod._LOCK:
        mod._CACHE["req-old0001"] = (
            __import__("time").time(),
            {
                "directorMode": "FULL",
                "contentHash": "h1",
                "scopeKey": "user:a",
                # missing contractFingerprint
                "payload": {"legacy": True},
            },
        )
    assert (
        cache_get(
            "req-old0001",
            director_mode="FULL",
            content_hash="h1",
            scope_key="user:a",
            contract_fingerprint=_fp(use_interpretation_v1=True),
        )
        is None
    )


@pytest.mark.asyncio
async def test_prepare_kill_switch_cache_miss(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    first = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-prepkill1",
        messages=_msg(),
        scope_key="user:a",
        interpretation_completer=_ok_interp,
    )
    assert first.reusedCache is False
    assert first.finalInterpretation is not None

    monkeypatch.setenv("EZA_MIRROR_INTERPRETATION_V1", "false")

    async def meaning_ok(_p):
        return {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "primaryTopic": "travel",
                                "topicCategory": "travel",
                                "secondaryTopics": ["Kyoto"],
                                "userIntent": "rain",
                                "emotionalTone": ["calm"],
                                "narrative": "Rain softens Kyoto.",
                                "visualMotifs": ["lanterns"],
                                "forbiddenSymbols": ["bathroom mirror"],
                                "suggestedPalette": ["amber"],
                                "suggestedComposition": "street lanterns at dusk",
                                "confidence": 0.93,
                            }
                        )
                    }
                }
            ]
        }

    draft_body = {
        "title": "Yağmur Altında Kyoto",
        "coreIdea": "Rain becomes the best part.",
        "narrativeAngle": "unexpected_discovery",
        "artDirection": "night_discovery",
        "sceneDescription": "Lantern-lit Kyoto street after rain.",
        "visualMotifs": ["lanterns"],
        "forbiddenSymbols": ["bathroom mirror"],
        "palette": ["amber"],
        "composition": "street-level cinematic scene",
        "lighting": "lantern practicals",
        "camera": "35mm eye-level",
        "typographyMood": "restrained editorial",
        "emotionalTone": ["calm"],
        "topicCategory": "travel",
        "confidence": 0.9,
    }

    async def draft_ok(_p):
        return {"choices": [{"message": {"content": json.dumps(draft_body)}}]}

    async def review_ok(_p):
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

    second = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-prepkill1",
        messages=_msg(),
        scope_key="user:a",
        interpretation_completer=_ok_interp,
        meaning_completer=meaning_ok,
        draft_completer=draft_ok,
        review_completer=review_ok,
    )
    assert second.reusedCache is False
    assert second.finalInterpretation is None
    assert second.finalDraft is not None


# ── HTTP classification ──────────────────────────────────────────────────────


def test_10_classify_429_rate_limit():
    signal = _classify_http_error(429, "Too Many Requests")
    assert signal.code == "rate_limit"
    assert signal.retryable is True


def test_11_classify_401_auth():
    signal = _classify_http_error(401, "unauthorized")
    assert signal.code == "auth_config"
    assert signal.retryable is False


def test_12_classify_503_retryable():
    signal = _classify_http_error(503, "unavailable")
    assert signal.code == "provider_error"
    assert signal.retryable is True


@pytest.mark.asyncio
async def test_10b_http_429_not_generic_provider_error(monkeypatch):
    ctx = build_mirror_conversation_context_v1(_msg(), conversation_id="http-429")
    monkeypatch.setattr(
        "backend.services.mirror.mirror_interpretation.get_settings",
        lambda: type("S", (), {"OPENAI_API_KEY": "sk-test", "EZA_MIRROR_INTERPRETATION_MODEL": None, "EZA_MIRROR_DRAFT_MODEL": None})(),
    )

    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = "rate limited"

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch(
        "backend.services.mirror.mirror_interpretation.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result = await generate_mirror_interpretation(ctx)

    assert result.ok is False
    assert result.code == "rate_limit"
    assert result.retryable is True
    assert result.code != "provider_error"


@pytest.mark.asyncio
async def test_11b_http_403_auth_non_retryable(monkeypatch):
    ctx = build_mirror_conversation_context_v1(_msg(), conversation_id="http-403")
    monkeypatch.setattr(
        "backend.services.mirror.mirror_interpretation.get_settings",
        lambda: type("S", (), {"OPENAI_API_KEY": "sk-test", "EZA_MIRROR_INTERPRETATION_MODEL": None, "EZA_MIRROR_DRAFT_MODEL": None})(),
    )
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "forbidden"
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)
    with patch(
        "backend.services.mirror.mirror_interpretation.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result = await generate_mirror_interpretation(ctx)
    assert result.ok is False
    assert result.code == "auth_config"
    assert result.retryable is False


@pytest.mark.asyncio
async def test_12b_http_500_retryable(monkeypatch):
    ctx = build_mirror_conversation_context_v1(_msg(), conversation_id="http-500")
    monkeypatch.setattr(
        "backend.services.mirror.mirror_interpretation.get_settings",
        lambda: type("S", (), {"OPENAI_API_KEY": "sk-test", "EZA_MIRROR_INTERPRETATION_MODEL": None, "EZA_MIRROR_DRAFT_MODEL": None})(),
    )
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "boom"
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)
    with patch(
        "backend.services.mirror.mirror_interpretation.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result = await generate_mirror_interpretation(ctx)
    assert result.ok is False
    assert result.code == "provider_error"
    assert result.retryable is True


@pytest.mark.asyncio
async def test_13_non_http_exception_provider_error():
    async def boom(_p):
        raise RuntimeError("socket closed")

    ctx = build_mirror_conversation_context_v1(_msg(), conversation_id="http-exc")
    result = await generate_mirror_interpretation(ctx, completer=boom)
    assert result.ok is False
    assert result.code == "provider_error"
    assert result.retryable is True


@pytest.mark.asyncio
async def test_14_fallback_telemetry_matches_signal(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    events: list[tuple[str, dict]] = []

    def _capture(event, **fields):
        events.append((event, fields))

    async def fail_interp(_ctx, **_kw):
        from backend.services.mirror.mirror_interpretation import MirrorInterpretationFailure

        return MirrorInterpretationFailure("rate_limit", "provider rate limited", retryable=True)

    with (
        patch(
            "backend.services.mirror.mirror_director_prepare.emit_director_event",
            side_effect=_capture,
        ),
        patch(
            "backend.services.mirror.mirror_director_prepare.generate_mirror_interpretation",
            side_effect=fail_interp,
        ),
    ):
        out = await prepare_mirror_director_draft(
            conversation_id="c1",
            generation_request_id="req-tele42901",
            messages=_msg(),
            scope_key="user:a",
        )
    assert out.usedDirector is True
    assert out.finalInterpretation is not None  # heuristic fallback
    fallback = [e for e in events if e[0] == "interpretation_fallback"]
    assert fallback
    assert fallback[0][1].get("reason") == "rate_limit"


# ── Regressions ──────────────────────────────────────────────────────────────


def test_15_d0_title_absent_from_prompt():
    interp = MirrorInterpretationV1.model_validate(_interp_json())
    mapped = map_interpretation_to_v5_prompt(interp, title_source="interpretation_llm")
    assert "TITLE:" not in mapped.prompt
    assert f'"{mapped.title}"' not in mapped.prompt
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt or "no text" in mapped.prompt.lower()


def test_16_d1_creative_authority_none():
    ctx = build_mirror_conversation_context_v1(_msg(), conversation_id="d1-reg")
    assert ctx.creativeAuthority == "none"


@pytest.mark.asyncio
async def test_17_d2_interpretation_authority_full(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    out = await prepare_mirror_director_draft(
        conversation_id="c1",
        generation_request_id="req-d2reg0001",
        messages=_msg(),
        interpretation_completer=_ok_interp,
    )
    assert out.finalInterpretation is not None
    assert out.finalDraft is None
    assert out.promptSource == "interpretation_v5_mapper"


def test_18_no_d3_review_gate():
    import backend.services.mirror.mirror_interpretation as im
    import backend.services.mirror.mirror_interpretation_to_v5 as mp

    for mod in (im, mp):
        src = inspect.getsource(mod)
        assert "MirrorDirectorReview" not in src
        assert "requiredChanges" not in src
        assert "approve_or_revise" not in src
