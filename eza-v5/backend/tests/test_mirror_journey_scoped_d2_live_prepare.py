# -*- coding: utf-8 -*-
"""Phase 3 live prepare closure — real D2 prepare with mocked LLM boundary.

Case A: scoped Q1–Q8 BMW/GLC only (source chat has nothing else).
Case B: same confirmed Q1–Q8; source chat also has Q9–Q16 Rome history.
Privacy: Q9 marker SECRET_PERSON_42 never enters scoped prepare.
"""

from __future__ import annotations

import json
import re
from typing import Any

import pytest

from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.journey_semantic_scope import (
    JOURNEY_SEMANTIC_SCOPE_V1,
    append_journey_scope_key,
    validate_journey_semantic_scope,
)
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import cache_clear_for_tests

ROME_LEAK_RE = re.compile(
    r"roma\b|roman\s+empire|imparatorlu[gğ]u|caesar|senato|antik\s+tarih|"
    r"ancient\s+history|colosseum|augustus",
    re.IGNORECASE,
)
BMW_RE = re.compile(r"bmw|x3|mercedes|glc|suv|aile\s*suv|family\s*suv", re.IGNORECASE)
SECRET_MARKER = "SECRET_PERSON_42"


@pytest.fixture(autouse=True)
def _clear_cache_and_mode(monkeypatch):
    cache_clear_for_tests()
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    monkeypatch.delenv("EZA_MIRROR_INTERPRETATION_V1", raising=False)
    yield
    cache_clear_for_tests()


def _bmw_steps() -> list[dict[str, Any]]:
    qa = [
        (
            "BMW X3 ve Mercedes GLC aile SUV olarak nasıl karşılaştırılır?",
            "X3 daha sportif sürüş, GLC daha konfor odaklı bir aile SUV hissi verir.",
        ),
        (
            "Aile için bagaj hacmi ve arka koltuk konforu hangisinde daha iyi?",
            "GLC bagaj ve arka sıra konforunda genelde bir adım önde; X3 daha sürücü odaklı.",
        ),
        (
            "Şehir içi kullanımda X3 mü GLC mi daha pratik?",
            "İkisi de şehirde kullanılabilir; X3 dönüş çapı ve çeviklikle öne çıkabilir.",
        ),
        (
            "Uzun yolda sessizlik ve konfor kriterim var, ne önerirsin?",
            "Uzun yol konforu için GLC daha sakin bir aile SUV tercihi olabilir.",
        ),
        (
            "Güvenlik donanımları açısından aile SUV seçiminde nelere bakmalıyım?",
            "Aktif güvenlik paketleri, ISOFIX ve görüş yardımcıları her iki modelde de kritik.",
        ),
        (
            "Yakıt tüketimi aile bütçesi için ne kadar fark eder?",
            "Sürüş tarzına bağlı; şehir içi yoğun kullanımda fark daha belirgin olabilir.",
        ),
        (
            "İkinci el değerini de düşünerek BMW X3 mi Mercedes GLC mi?",
            "Segmentte ikisi de güçlü; bakım maliyeti ve donanım paketi kararını etkiler.",
        ),
        (
            "Son karar: aile SUV olarak hangisini seçmeliyim?",
            "Konfor öncelikliyse GLC, dinamik sürüş istiyorsan X3 mantıklı bir kapanış.",
        ),
    ]
    steps = []
    for i, (q, a) in enumerate(qa):
        steps.append(
            {
                "stepIndex": i + 1,
                "sourceOrder": i,
                "sourceUserMessageId": f"u-bmw-{i + 1}",
                "sourceAssistantMessageId": f"a-bmw-{i + 1}",
                "publicQuestion": q,
                "publicAnswer": a,
            }
        )
    return steps


def _messages_from_steps(steps: list[dict[str, Any]]) -> list[MirrorConversationMessageDTO]:
    rows: list[MirrorConversationMessageDTO] = []
    for step in steps:
        rows.append(
            MirrorConversationMessageDTO(
                role="user",
                text=step["publicQuestion"],
                sequence=int(step["sourceOrder"]) * 2,
            )
        )
        rows.append(
            MirrorConversationMessageDTO(
                role="assistant",
                text=step["publicAnswer"],
                sequence=int(step["sourceOrder"]) * 2 + 1,
            )
        )
    return rows


def _scope_payload(steps: list[dict[str, Any]]) -> dict[str, Any]:
    from backend.services.mirror.journey_window_hashes import (
        compute_scoped_input_hash,
        compute_window_hash,
    )

    window_hash = compute_window_hash(steps)
    scoped_input_hash = compute_scoped_input_hash(
        journey_id="journey-bmw-live",
        journey_version=1,
        source_conversation_id="conv-live-scoped",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=steps,
    )
    return {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": "journey-bmw-live",
        "journeyVersion": 1,
        "sourceConversationId": "conv-live-scoped",
        "parentJourneyId": None,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": window_hash,
        "scopedInputHash": scoped_input_hash,
        "selectedSteps": steps,
    }


def _extract_user_payload(request_body: dict[str, Any]) -> dict[str, Any]:
    messages = request_body.get("messages") or []
    assert messages, "interpretation completer must receive chat messages"
    user = next((m for m in messages if m.get("role") == "user"), None)
    assert user and isinstance(user.get("content"), str)
    return json.loads(user["content"])


def _evidence_blob(user_payload: dict[str, Any]) -> str:
    return json.dumps(user_payload.get("evidencePackage") or {}, ensure_ascii=False)


def reflective_interpretation_from_llm_payload(request_body: dict[str, Any]) -> dict[str, Any]:
    """
    Mock LLM boundary: parse the real D2 evidence package and echo only what is present.

    If outside-window tokens leaked into the constructed prompt, they are copied into
    the interpretation so isolation assertions fail closed.
    """
    payload = _extract_user_payload(request_body)
    assert payload.get("task") == "interpret_conversation_as_mirror_scene"
    blob = _evidence_blob(payload)
    assert BMW_RE.search(blob), "scoped evidence must contain BMW/GLC family SUV signal"

    if SECRET_MARKER in blob or ROME_LEAK_RE.search(blob):
        leak = SECRET_MARKER if SECRET_MARKER in blob else ROME_LEAK_RE.search(blob).group(0)
        return {
            "title": f"Leak {leak}"[:64],
            "interpretationSummary": (
                f"Evidence package incorrectly contains outside-window topic: {leak}."
            ),
            "rationale": f"Reflective mock echoed leaked marker {leak} from evidencePackage.",
            "imageIntent": f"Scene wrongly centered on {leak}.",
            "visualNarrative": (
                f"A scene dominated by {leak} and unrelated ancient-history cues, "
                f"showing that outside-window content reached D2 evidence."
            ),
            "exclusions": ["object collage", "poster typography"],
            "confidence": 0.4,
            "topicCategory": "travel",
            "atmosphereHint": "leaked",
        }

    return {
        "title": "BMW X3 ve GLC Aile SUV",
        "interpretationSummary": (
            "Kullanıcı BMW X3 ile Mercedes GLC arasında aile SUV konforu, "
            "güvenlik ve uzun yol dengesi arıyor."
        ),
        "rationale": (
            "Evidence package centers on family SUV comparison between X3 and GLC; "
            "comfort versus sporty driving is the decision tension."
        ),
        "imageIntent": (
            "A stranger should feel a quiet family-SUV decision moment, not a history lesson."
        ),
            "visualNarrative": (
                "A calm dusk road beside a modern family SUV — BMW X3 and Mercedes GLC "
                "comparison energy held in one natural parked-road moment, soft cabin light, "
                "no collage, no checklist tourism."
            ),
        "exclusions": [
            "object collage",
            "poster typography",
            "readable signs",
            "generic stock tourism",
        ],
        "confidence": 0.9,
        "topicCategory": "vehicle",
        "atmosphereHint": "calm decisive dusk",
    }


def _assert_no_outside_leak(blob: str, *, label: str) -> None:
    assert SECRET_MARKER not in blob, f"{label} leaked {SECRET_MARKER}"
    assert not ROME_LEAK_RE.search(blob), f"{label} leaked Roman-history content: {blob[:240]}"


def _dump_prepare(out) -> str:
    parts = [
        json.dumps(out.finalInterpretation.model_dump() if out.finalInterpretation else {}, ensure_ascii=False),
        json.dumps(
            out.conversationContext.model_dump() if out.conversationContext else {},
            ensure_ascii=False,
        ),
        (out.mappedPrompt.prompt if out.mappedPrompt else "") or "",
        (out.mappedPrompt.title if out.mappedPrompt else "") or "",
    ]
    return "\n".join(parts)


@pytest.mark.asyncio
async def test_live_prepare_case_a_vs_b_scoped_isolation():
    steps = _bmw_steps()
    messages = _messages_from_steps(steps)
    scope = _scope_payload(steps)

    # Source conversation variants exist only outside prepare — scoped package is identical.
    source_a_texts = [s["publicQuestion"] + s["publicAnswer"] for s in steps]
    source_b_extra = [
        "Roma İmparatorluğu tarihi nasıl başladı?",
        "Caesar ve senato ilişkisi neydi?",
        "Antik tarih Colosseum dönemi",
        "Augustus reformları",
        f"Bu arada {SECRET_MARKER} hakkında özel bir şey var mı?",
    ]
    assert any("BMW" in t for t in source_a_texts)
    assert any(ROME_LEAK_RE.search(t) for t in source_b_extra)
    assert any(SECRET_MARKER in t for t in source_b_extra)

    meta_a = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=[m.model_dump() for m in messages],
    )
    meta_b = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=[m.model_dump() for m in messages],
    )
    assert meta_a["windowHash"] == meta_b["windowHash"] == scope["windowHash"]
    assert meta_a["scopedInputHash"] == meta_b["scopedInputHash"] == scope["scopedInputHash"]

    captured: list[dict[str, Any]] = []

    async def interpretation_completer(request_body: dict[str, Any]):
        captured.append(request_body)
        content = reflective_interpretation_from_llm_payload(request_body)
        return {"choices": [{"message": {"content": json.dumps(content, ensure_ascii=False)}}]}

    scope_key = append_journey_scope_key("user:live-prepare", meta_a)

    # Router strips title/summary when journey scope is bound — exercise the same inputs.
    out_a = await prepare_mirror_director_draft(
        conversation_id="conv-live-scoped",
        generation_request_id="req-live-prepare-a1",
        messages=list(messages),
        title=None,
        conversation_summary=None,
        scope_key=scope_key,
        interpretation_completer=interpretation_completer,
    )
    # Case B: identical scoped messages (Rome/SECRET never delivered to prepare).
    out_b = await prepare_mirror_director_draft(
        conversation_id="conv-live-scoped",
        generation_request_id="req-live-prepare-b1",
        messages=list(messages),
        title=None,
        conversation_summary=None,
        scope_key=scope_key,
        interpretation_completer=interpretation_completer,
    )

    assert len(captured) == 2
    blob_a = _evidence_blob(_extract_user_payload(captured[0]))
    blob_b = _evidence_blob(_extract_user_payload(captured[1]))
    assert blob_a == blob_b
    _assert_no_outside_leak(blob_a, label="D2 evidencePackage A")
    _assert_no_outside_leak(blob_b, label="D2 evidencePackage B")

    # D2 receives only selected 8 Q/A (16 turns) in evidence messages.
    evidence_msgs = (_extract_user_payload(captured[1]).get("evidencePackage") or {}).get(
        "messages"
    ) or []
    user_texts = [m.get("text", "") for m in evidence_msgs if m.get("role") == "user"]
    assert len(user_texts) == 8
    for step, text in zip(steps, user_texts, strict=True):
        assert step["publicQuestion"] == text

    assert out_a.usedDirector is True
    assert out_b.usedDirector is True
    assert out_a.interpretationSource == "d2_llm"
    assert out_b.interpretationSource == "d2_llm"
    assert out_a.finalInterpretation is not None
    assert out_b.finalInterpretation is not None
    assert out_a.mappedPrompt is not None
    assert out_b.mappedPrompt is not None
    assert out_a.contentHash == out_b.contentHash
    assert out_a.contentHash

    for label, out in (("A", out_a), ("B", out_b)):
        dump = _dump_prepare(out)
        _assert_no_outside_leak(dump, label=f"prepare output {label}")
        assert BMW_RE.search(dump), f"prepare output {label} lost BMW/GLC signal"
        assert out.mappedPrompt and "VISUAL NARRATIVE" in out.mappedPrompt.prompt

@pytest.mark.asyncio
async def test_live_prepare_fixture_matches_runner_output():
    """Keep frontend fixture aligned with the real prepare + reflective mock path."""
    from pathlib import Path

    steps = _bmw_steps()
    messages = _messages_from_steps(steps)
    scope = _scope_payload(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=[m.model_dump() for m in messages],
    )

    async def interpretation_completer(request_body: dict[str, Any]):
        content = reflective_interpretation_from_llm_payload(request_body)
        return {"choices": [{"message": {"content": json.dumps(content, ensure_ascii=False)}}]}

    out = await prepare_mirror_director_draft(
        conversation_id="conv-live-scoped",
        generation_request_id="req-live-fixture-01",
        messages=list(messages),
        scope_key=append_journey_scope_key("user:live-fixture", meta),
        interpretation_completer=interpretation_completer,
    )
    payload = {
        "windowHash": scope["windowHash"],
        "scopedInputHash": scope["scopedInputHash"],
        "contentHash": out.contentHash,
        "interpretationSource": out.interpretationSource,
        "finalInterpretation": (
            out.finalInterpretation.model_dump() if out.finalInterpretation else None
        ),
        "mappedPrompt": out.mappedPrompt.model_dump() if out.mappedPrompt else None,
        "conversationContext": (
            out.conversationContext.model_dump() if out.conversationContext else None
        ),
        "scopedMessages": [m.model_dump() for m in messages],
        "journeyId": scope["journeyId"],
    }
    fixture_path = (
        Path(__file__).resolve().parent
        / "fixtures"
        / "journey_scoped_live_prepare_b.json"
    )
    assert fixture_path.is_file(), (
        "Missing live prepare fixture — run "
        "tests/helpers/journey_scoped_live_prepare_runner.py and save JSON output"
    )
    loaded = json.loads(fixture_path.read_text(encoding="utf-8"))
    assert loaded["interpretationSource"] == "d2_llm"
    assert loaded["contentHash"] == payload["contentHash"]
    assert loaded["finalInterpretation"] == payload["finalInterpretation"]
    assert loaded["mappedPrompt"] == payload["mappedPrompt"]
    assert loaded["scopedMessages"] == payload["scopedMessages"]
    assert loaded["windowHash"] == meta["windowHash"]
    assert loaded["scopedInputHash"] == meta["scopedInputHash"]
    _assert_no_outside_leak(json.dumps(loaded, ensure_ascii=False), label="fixture")


@pytest.mark.asyncio
async def test_live_prepare_privacy_marker_never_in_d2_artifacts():
    steps = _bmw_steps()
    messages = _messages_from_steps(steps)
    scope = _scope_payload(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=[m.model_dump() for m in messages],
    )
    captured: list[str] = []

    async def interpretation_completer(request_body: dict[str, Any]):
        blob = _evidence_blob(_extract_user_payload(request_body))
        captured.append(blob)
        content = reflective_interpretation_from_llm_payload(request_body)
        return {"choices": [{"message": {"content": json.dumps(content, ensure_ascii=False)}}]}

    out = await prepare_mirror_director_draft(
        conversation_id="conv-live-privacy",
        generation_request_id="req-live-privacy-01",
        messages=list(messages),
        scope_key=append_journey_scope_key("user:live-privacy", meta),
        interpretation_completer=interpretation_completer,
    )
    assert captured
    for blob in captured:
        assert SECRET_MARKER not in blob
        assert not ROME_LEAK_RE.search(blob)
    dump = _dump_prepare(out)
    assert SECRET_MARKER not in dump
    assert not ROME_LEAK_RE.search(dump)


@pytest.mark.asyncio
async def test_live_prepare_router_strips_title_summary_when_scope_bound(monkeypatch):
    """HTTP prepare path: journey scope validates messages and strips chat title/summary."""
    from unittest.mock import AsyncMock

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from backend.auth.mirror_entitlement import require_mirror_scene_actor
    from backend.core.schemas.mirror_prepare_director import (
        MirrorPrepareDirectorDraftRequest,
        MirrorPrepareDirectorDraftResponse,
    )
    from backend.core.utils.dependencies import get_db
    from backend.routers import standalone_mirror as sm
    from backend.security.rate_limit import rate_limit_standalone

    steps = _bmw_steps()
    messages = [m.model_dump() for m in _messages_from_steps(steps)]
    scope = _scope_payload(steps)
    seen: dict[str, Any] = {}

    async def fake_prepare(**kwargs):
        seen["title"] = kwargs.get("title")
        seen["conversation_summary"] = kwargs.get("conversation_summary")
        seen["messages"] = kwargs.get("messages")
        seen["scope_key"] = kwargs.get("scope_key")
        return MirrorPrepareDirectorDraftResponse(
            directorEnabled=True,
            usedDirector=True,
            directorMode="FULL",
            directorExecuted=True,
            directorAffectedOutput=True,
            applyTitle=True,
            applyPrompt=True,
            contentHash="hash-live",
            interpretationSource="d2_llm",
        )

    monkeypatch.setattr(sm, "prepare_mirror_director_draft", fake_prepare)

    class _Subject:
        is_authenticated = False
        guest_fingerprint = "guest-live-fp-123456"

    async def _resolve(*_a, **_k):
        return _Subject()

    monkeypatch.setattr(sm, "resolve_account_subject", _resolve)

    app = FastAPI()
    app.include_router(sm.router)

    class _Actor:
        user = None

    app.dependency_overrides[require_mirror_scene_actor] = lambda: _Actor()
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[rate_limit_standalone] = lambda: None

    client = TestClient(app)
    res = client.post(
        "/api/standalone/mirror/prepare-director-draft",
        headers={"X-Guest-Token": "guest-token-abcdefghijklmnop"},
        json={
            "conversationId": "conv-live-scoped",
            "generationRequestId": "req-live-http-0001",
            "messages": messages,
            "title": f"Rome Caesar {SECRET_MARKER}",
            "conversationSummary": "Roman Empire ancient history discussion",
            "journeySemanticScope": scope,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert seen["title"] is None
    assert seen["conversation_summary"] is None
    assert seen["messages"] is not None
    assert len(seen["messages"]) == 16
    assert "journey:" in (seen["scope_key"] or "")
    assert body.get("semanticScope") == JOURNEY_SEMANTIC_SCOPE_V1
    assert body.get("semanticSourceJourneyId") == "journey-bmw-live"
    assert body.get("semanticWindowHash") == scope["windowHash"]
    assert body.get("scopedInputHash") == scope["scopedInputHash"]
    # Request schema still accepts the contaminated fields; they must not reach prepare.
    MirrorPrepareDirectorDraftRequest.model_validate(
        {
            "conversationId": "conv-live-scoped",
            "generationRequestId": "req-live-http-0001",
            "messages": messages,
            "title": f"Rome Caesar {SECRET_MARKER}",
            "journeySemanticScope": scope,
        }
    )
