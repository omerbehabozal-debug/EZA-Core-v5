# -*- coding: utf-8 -*-
"""PR D2 — Mirror Interpretation creative authority tests."""

from __future__ import annotations

import inspect
import json

import pytest

from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_conversation_context import (
    build_mirror_conversation_context_v1,
)
from backend.services.mirror.mirror_director_mode import get_mirror_director_execution_policy
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_prepare_cache import cache_clear_for_tests
from backend.services.mirror.mirror_interpretation import (
    build_heuristic_interpretation,
    generate_mirror_interpretation,
)
from backend.services.mirror.mirror_interpretation_to_v5 import (
    MIRROR_TEXT_FREE_SCENE_RULE,
    interpretation_hash,
    map_interpretation_to_v5_prompt,
)


@pytest.fixture(autouse=True)
def _clear_cache(monkeypatch):
    cache_clear_for_tests()
    monkeypatch.delenv("EZA_MIRROR_INTERPRETATION_V1", raising=False)
    yield
    cache_clear_for_tests()


def _msg(role: str, text: str, sequence: int) -> MirrorConversationMessageDTO:
    return MirrorConversationMessageDTO(role=role, text=text, sequence=sequence)  # type: ignore[arg-type]


def _interp_payload(**overrides) -> dict:
    base = {
        "title": "Yağmur Altında Kyoto",
        "interpretationSummary": (
            "A Kyoto evening walk reshaped by rain and narrow lantern streets."
        ),
        "rationale": (
            "User sought atmosphere over checklist tourism; rain and Pontocho leanings matter."
        ),
        "imageIntent": (
            "A stranger should feel a damp Kyoto evening street before the rain settles in."
        ),
        "visualNarrative": (
            "A narrow Pontocho-like lane at dusk, wet stone beginning to shine, "
            "warm lantern glow, a quiet café doorway ahead — one continuous natural moment."
        ),
        "exclusions": [
            "object collage",
            "geisha cliché",
            "poster typography",
            "readable signs",
            "generic stock tourism",
        ],
        "confidence": 0.91,
        "topicCategory": "travel",
        "atmosphereHint": "humid dusk before rain",
    }
    base.update(overrides)
    return base


async def _interp_ok(_p):
    return {"choices": [{"message": {"content": json.dumps(_interp_payload())}}]}


def test_1_conversation_recognizable_after_interpretation():
    msgs = [
        _msg("user", "Kyoto'da akşam yürüyüşü yapmak istiyorum.", 0),
        _msg("assistant", "Gion veya Pontocho önerebilirim.", 1),
        _msg("user", "Sokak lambaları ve dar sokaklar ilgimi çekiyor.", 2),
    ]
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="d2-rec")
    interp = build_heuristic_interpretation(ctx)
    mapped = map_interpretation_to_v5_prompt(
        interp, title_source="interpretation_heuristic"
    )
    blob = " ".join(
        [
            interp.interpretationSummary,
            interp.visualNarrative,
            interp.imageIntent,
            mapped.prompt,
        ]
    ).lower()
    assert "kyoto" in blob or "pontocho" in blob or "sokak" in blob or "lantern" in blob


def test_2_long_conversation_preserves_development():
    msgs = []
    seq = 0
    for i, text in enumerate(
        [
            "Kyoto gezisi planlıyorum.",
            "Gion mi Pontocho mu?",
            "Sokak lambaları ilgimi çekiyor.",
            "Küçük bir kafe de olsun.",
            "Yağmur yağarsa plan nasıl değişir?",
        ]
    ):
        msgs.append(_msg("user", text, seq))
        seq += 1
        msgs.append(_msg("assistant", f"Yanıt {i}: ilgili öneri.", seq))
        seq += 1
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="d2-long")
    assert ctx.conversationArc.developmentBeats
    assert ctx.conversationArc.openingIntent
    assert ctx.conversationArc.currentState
    interp = build_heuristic_interpretation(ctx)
    narrative = interp.visualNarrative.lower()
    # Development should surface in narrative (opening + later beats / rain).
    assert "kyoto" in narrative or "yürüyüş" in narrative or "gezisi" in narrative
    assert (
        "yağmur" in narrative
        or "rain" in narrative
        or "kafe" in narrative
        or "pontocho" in narrative
        or "sokak" in narrative
    )


def test_3_rejected_options_become_exclusions():
    msgs = [
        _msg("user", "Gion istiyorum.", 0),
        _msg("assistant", "Gion veya Pontocho olabilir.", 1),
        _msg("user", "Pontocho istemiyorum, Gion kalsın.", 2),
    ]
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="d2-reject")
    rejected = [g for g in ctx.factualGrounding if g.epistemic == "rejected_option"]
    assert rejected, "D1 should mark rejected options"
    interp = build_heuristic_interpretation(ctx)
    excl = " ".join(interp.exclusions).lower()
    assert "pontocho" in excl or "rejected" in excl
    # Chosen narrative should lean Gion, not promote rejected Pontocho as the center.
    chosen = (interp.visualNarrative + " " + interp.interpretationSummary).lower()
    assert "gion" in chosen or "kyoto" in chosen or "yürüyüş" in chosen or "istiyorum" in chosen


def test_4_corrections_influence_interpretation():
    msgs = [
        _msg("user", "Sağlık için koşu planı istiyorum.", 0),
        _msg("assistant", "Park koşusu öneririm.", 1),
        _msg("user", "Hayır, yüzme olsun, koşu değil.", 2),
    ]
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="d2-corr")
    assert ctx.correctionsAndRevisions or any(
        g.epistemic == "rejected_option" for g in ctx.factualGrounding
    )
    interp = build_heuristic_interpretation(ctx)
    blob = " ".join(
        [interp.visualNarrative, interp.rationale, " ".join(interp.exclusions)]
    ).lower()
    assert "yüzme" in blob or "correction" in blob or "koşu" in blob


def test_5_object_collage_regression_in_prompt_and_exclusions():
    interp = MirrorInterpretationV1.model_validate(_interp_payload())
    mapped = map_interpretation_to_v5_prompt(interp, title_source="interpretation_llm")
    low = mapped.prompt.lower()
    assert "collage" in low or "object catalog" in low or "not a poster" in low
    assert any("collage" in e.lower() for e in interp.exclusions)


def test_6_generic_stock_image_regression():
    interp = MirrorInterpretationV1.model_validate(_interp_payload())
    mapped = map_interpretation_to_v5_prompt(interp, title_source="interpretation_llm")
    low = mapped.prompt.lower()
    assert "stock" in low or "tourism" in low
    assert "one natural scene" in low or "natural cinematic" in low or "continuous" in (
        interp.visualNarrative.lower()
    )


def test_7_d1_evidence_consumed_not_copied_verbatim():
    msgs = [
        _msg("user", "Kyoto'da yağmurlu akşam planı.", 0),
        _msg("user", "Pontocho dar sokakları istiyorum.", 1),
    ]
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="d2-d1")
    assert ctx.creativeAuthority == "none"
    # Interpretation fields must not be present on D1 package.
    dumped = ctx.model_dump()
    for banned in (
        "visualNarrative",
        "imageIntent",
        "interpretationSummary",
        "sceneDescription",
        "visualThesis",
    ):
        assert banned not in dumped
    interp = build_heuristic_interpretation(ctx)
    # Heuristic may paraphrase arc text but must not be a field-for-field copy of D1.
    assert interp.visualNarrative != (ctx.conversationArc.openingIntent or "")
    assert interp.imageIntent != (ctx.sourceCoverage or "")


def test_8_d0_text_free_guarantee():
    interp = MirrorInterpretationV1.model_validate(_interp_payload())
    mapped = map_interpretation_to_v5_prompt(interp, title_source="interpretation_llm")
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt or "no text" in mapped.prompt.lower()
    assert "TITLE:" not in mapped.prompt
    assert f'"{mapped.title}"' not in mapped.prompt
    assert "typography" in mapped.prompt.lower() or "no text" in mapped.prompt.lower()


@pytest.mark.asyncio
async def test_9_legacy_rollout_still_functions(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "LEGACY")

    async def boom(_p):
        raise AssertionError("LLM must not run in LEGACY")

    out = await prepare_mirror_director_draft(
        conversation_id="d2-legacy",
        generation_request_id="req-d2legacy1",
        messages=[_msg("user", "Kyoto yağmur", 0)],
        interpretation_completer=boom,
        meaning_completer=boom,
        draft_completer=boom,
        review_completer=boom,
    )
    assert out.directorMode == "LEGACY"
    assert out.directorExecuted is False
    assert out.finalInterpretation is None
    assert out.conversationContext is not None
    assert out.applyPrompt is False


def test_10_no_d3_review_or_rejection_in_interpretation_path():
    import backend.services.mirror.mirror_interpretation as interp_mod
    import backend.services.mirror.mirror_interpretation_to_v5 as map_mod

    for mod in (interp_mod, map_mod):
        src = inspect.getsource(mod)
        # Soft check: no review/rejection orchestration language as creative gate
        assert "reject the draft" not in src.lower()
        assert "approve_or_revise" not in src.lower()
        assert "MirrorDirectorReview" not in src
        assert "requiredChanges" not in src

    policy = get_mirror_director_execution_policy("FULL")
    assert policy.use_interpretation_v1 is True
    assert policy.run_review is False
    assert policy.run_draft is False
    assert policy.run_meaning_analysis is False


@pytest.mark.asyncio
async def test_full_uses_interpretation_not_meaning_draft(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    calls = {"interp": 0, "meaning": 0, "draft": 0, "review": 0}

    async def interp(_p):
        calls["interp"] += 1
        return await _interp_ok(_p)

    async def meaning(_p):
        calls["meaning"] += 1
        raise AssertionError("meaning should not run under D2")

    async def draft(_p):
        calls["draft"] += 1
        raise AssertionError("draft should not run under D2")

    async def review(_p):
        calls["review"] += 1
        raise AssertionError("review should not run under D2")

    out = await prepare_mirror_director_draft(
        conversation_id="d2-full",
        generation_request_id="req-d2full0001",
        messages=[
            _msg("user", "Kyoto'da akşam yürüyüşü", 0),
            _msg("user", "Yağmur yağarsa plan nasıl değişir?", 1),
        ],
        interpretation_completer=interp,
        meaning_completer=meaning,
        draft_completer=draft,
        review_completer=review,
    )
    assert calls["interp"] == 1
    assert calls["meaning"] == 0
    assert calls["draft"] == 0
    assert calls["review"] == 0
    assert out.finalInterpretation is not None
    assert out.finalDraft is None
    assert out.promptSource == "interpretation_v5_mapper"
    assert out.mappedPrompt is not None
    assert "VISUAL NARRATIVE" in out.mappedPrompt.prompt
    assert out.metadata is not None
    assert out.metadata.draftSource == "interpretation_llm"
    assert interpretation_hash(out.finalInterpretation)


@pytest.mark.asyncio
async def test_kill_switch_restores_meaning_draft(monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_DIRECTOR_MODE", "FULL")
    monkeypatch.setenv("EZA_MIRROR_INTERPRETATION_V1", "false")

    policy = get_mirror_director_execution_policy()
    assert policy.use_interpretation_v1 is False
    assert policy.run_draft is True
    assert policy.run_review is True

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

    draft_body = {
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

    async def boom_interp(_p):
        raise AssertionError("interpretation must not run when kill-switch off")

    out = await prepare_mirror_director_draft(
        conversation_id="d2-kill",
        generation_request_id="req-d2kill0001",
        messages=[_msg("user", "Kyoto yağmur", 0)],
        interpretation_completer=boom_interp,
        meaning_completer=meaning_ok,
        draft_completer=draft_ok,
        review_completer=review_ok,
    )
    assert out.finalInterpretation is None
    assert out.finalDraft is not None
    assert out.promptSource == "director_v5_mapper"


@pytest.mark.asyncio
async def test_generate_interpretation_success_path():
    ctx = build_mirror_conversation_context_v1(
        [_msg("user", "Kyoto'da yağmurlu akşam", 0)],
        conversation_id="d2-gen",
    )
    result = await generate_mirror_interpretation(ctx, completer=_interp_ok)
    assert result.ok
    assert result.interpretation.title == "Yağmur Altında Kyoto"
    assert result.source == "interpretation_llm"


def test_interpretation_system_prompt_requires_place_fidelity():
    from backend.services.mirror.mirror_interpretation import (
        MIRROR_INTERPRETATION_PROMPT_VERSION,
        _SYSTEM_PROMPT,
    )

    assert MIRROR_INTERPRETATION_PROMPT_VERSION == "interp-prompt-v2"
    low = _SYSTEM_PROMPT.lower()
    assert "place and evidence fidelity" in low
    assert "lived street-level" in low
    assert "stock tourism" in low
    assert "substitute region" in low
    # No place/benchmark hardcodes in the director prompt.
    for banned in ("mardin", "trench", "panda", "cappadocia", "kyoto"):
        assert banned not in low
