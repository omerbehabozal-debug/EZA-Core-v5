# -*- coding: utf-8 -*-
"""PR D1 — Conversation Understanding Context Package tests."""

from __future__ import annotations

import inspect

import pytest

from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.mirror_conversation_context import (
    assert_context_has_no_creative_fields,
    build_mirror_conversation_context_v1,
    select_assistant_texts_for_snapshot,
)
from backend.services.mirror.mirror_director_prepare import _dto_to_snapshot
from backend.services.mirror.openai_prompt_builder import (
    V5_PROMPT_CONTRACT,
    build_openai_mirror_prompt,
)
from backend.services.mirror.types import MirrorImageRequest
from backend.services.mirror.mirror_draft_to_v5 import (
    MIRROR_TEXT_FREE_SCENE_RULE,
    map_mirror_draft_to_v5_prompt,
)
from backend.core.schemas.mirror_draft import MirrorDraft


def _msg(role: str, text: str, sequence: int) -> MirrorConversationMessageDTO:
    return MirrorConversationMessageDTO(role=role, text=text, sequence=sequence)  # type: ignore[arg-type]


def _kyoto_thread() -> list[MirrorConversationMessageDTO]:
    return [
        _msg("user", "Kyoto'da akşam yürüyüşü yapmak istiyorum.", 0),
        _msg(
            "assistant",
            "Gion, Kamo Nehri, Philosopher’s Path, Kinkaku-ji, Arashiyama öneririm.",
            1,
        ),
        _msg("user", "Gion tarafı mı yoksa Pontocho mu?", 2),
        _msg(
            "assistant",
            "Gion daha geniş; Pontocho dar sokakları, lambaları ve restoranlarıyla öne çıkar.",
            3,
        ),
        _msg("user", "Sokak lambaları ve dar sokaklar ilgimi çekiyor.", 4),
        _msg(
            "assistant",
            "O zaman Pontocho uygun; küçük kafeler ve Kamo kenarı da yakın.",
            5,
        ),
        _msg("user", "Küçük bir kafe önerir misin?", 6),
        _msg("assistant", "Kissaten tarzı küçük bir kafe önerebilirim, belki denemek istersiniz.", 7),
        _msg("user", "Yağmur yağarsa plan nasıl değişir?", 8),
        _msg("assistant", "Kapalı mekanlar, müzeler ve çay seremonisi düşünülebilir.", 9),
    ]


def test_multi_turn_preserves_opening_and_journey():
    ctx = build_mirror_conversation_context_v1(
        _kyoto_thread(), conversation_id="chat-kyoto-d1"
    )
    assert ctx.conversationArc.openingIntent
    assert "Kyoto" in (ctx.conversationArc.openingIntent or "")
    assert ctx.conversationArc.currentState
    assert "Yağmur" in (ctx.conversationArc.currentState or "") or "yağmur" in (
        ctx.conversationArc.currentState or ""
    ).lower()
    joined = " ".join(ctx.conversationArc.developmentBeats).lower()
    assert "pontocho" in joined or "gion" in joined or "sokak" in joined
    assert ctx.diagnostics.userMessageCount >= 5
    assert ctx.creativeAuthority == "none"


def test_user_correction_captured():
    msgs = [
        _msg("user", "Tokyo'da yürüyüş istiyorum.", 0),
        _msg("assistant", "Shibuya öneririm.", 1),
        _msg("user", "Aslında Kyoto olsun, Tokyo değil.", 2),
    ]
    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="chat-corr")
    assert ctx.diagnostics.correctionCount >= 1
    assert any("Kyoto" in c.text for c in ctx.correctionsAndRevisions)
    assert ctx.conversationArc.openingIntent and "Tokyo" in ctx.conversationArc.openingIntent
    assert ctx.conversationArc.currentState and "Kyoto" in ctx.conversationArc.currentState


def test_rejected_option_epistemic():
    msgs = [
        _msg("user", "Gion istiyorum.", 0),
        _msg("user", "Pontocho istemiyorum, Gion kalsın.", 1),
    ]
    ctx = build_mirror_conversation_context_v1(msgs)
    rejected = [d for d in ctx.factualGrounding if d.epistemic == "rejected_option"]
    assert rejected
    assert any("Pontocho" in r.text or "istemiyorum" in r.text.lower() for r in rejected)


def test_long_conversation_bounded_but_keeps_ends():
    msgs: list[MirrorConversationMessageDTO] = []
    seq = 0
    msgs.append(_msg("user", "Başlangıç: Kyoto planı istiyorum.", seq))
    seq += 1
    for i in range(30):
        msgs.append(_msg("user", f"Orta detay numarası {i} hakkında soru?", seq))
        seq += 1
        msgs.append(_msg("assistant", f"Orta asistan cevabı {i} önerisi olabilir.", seq))
        seq += 1
    msgs.append(_msg("user", "Son karar: Pontocho ve yağmur planı.", seq))

    ctx = build_mirror_conversation_context_v1(msgs, conversation_id="chat-long")
    assert ctx.diagnostics.sourceMessageCount > ctx.diagnostics.selectedMessageCount
    assert ctx.diagnostics.charEstimate <= 6000 + 500  # soft bound with caps
    texts = " ".join(m.text for m in ctx.messages)
    assert "Başlangıç" in texts or "Kyoto" in texts
    assert "Son karar" in texts or "Pontocho" in texts


def test_topic_and_journey_both_present():
    ctx = build_mirror_conversation_context_v1(_kyoto_thread())
    prefs = ctx.userPreferences
    assert any("ilgimi" in p.text.lower() or "sokak" in p.text.lower() for p in prefs) or any(
        d.kind == "preference" for d in ctx.salientDetails
    )
    assert ctx.conversationArc.openingIntent
    assert ctx.conversationArc.developmentBeats or ctx.conversationArc.directionChanges


def test_assistant_suggestion_not_user_fact():
    msgs = [
        _msg("user", "Kafe arıyorum.", 0),
        _msg("assistant", "Belki şu kissateni önerebilirim, denemek istersiniz.", 1),
    ]
    ctx = build_mirror_conversation_context_v1(msgs)
    assert ctx.uncertaintyNotes
    asst = [d for d in ctx.salientDetails if d.speaker == "assistant"]
    assert asst
    assert all(d.epistemic in {"assistant_suggestion", "uncertain", "hypothesis"} for d in asst)


def test_speaker_roles_distinguishable():
    ctx = build_mirror_conversation_context_v1(_kyoto_thread())
    roles = {m.role for m in ctx.messages}
    assert "user" in roles
    assert "assistant" in roles
    for d in ctx.salientDetails:
        assert d.evidence.role == d.speaker


def test_no_creative_fields_in_d1_package():
    ctx = build_mirror_conversation_context_v1(_kyoto_thread())
    assert_context_has_no_creative_fields(ctx)
    dumped = ctx.model_dump()
    for bad in (
        "visualThesis",
        "sceneSummary",
        "metaphor",
        "imagePrompt",
        "composition",
        "lighting",
        "camera",
        "emotionalCenter",
    ):
        assert bad not in dumped


def test_assistant_snapshot_selection_keeps_latest():
    assistants = [
        "İlk genel Kyoto önerileri Gion Kamo.",
        "İkinci karşılaştırma Gion vs Pontocho.",
        "Üçüncü kafe önerisi detayı.",
        "Dördüncü yağmur planı kapalı mekan.",
    ]
    selected = select_assistant_texts_for_snapshot(assistants)
    assert len(selected) <= 3
    assert selected[0].startswith("İlk")
    assert any("yağmur" in s.lower() or "Dördüncü" in s for s in selected)


def test_dto_to_snapshot_includes_late_assistant():
    msgs = _kyoto_thread()
    snap = _dto_to_snapshot(msgs, title=None, conversation_summary=None)
    asst = [m.text for m in snap.messages if m.role == "assistant"]
    assert asst
    blob = " ".join(asst).lower()
    # Late rain / cafe assistants should be eligible (not earliest-only).
    assert "yağmur" in blob or "kafe" in blob or "pontocho" in blob or "kapalı" in blob


def test_d0_text_free_regression_on_mapper():
    draft = MirrorDraft.model_validate(
        {
            "title": "Yağmurdan Önce Kyoto",
            "coreIdea": "Akşam atmosferi arayışı",
            "narrativeAngle": "adaptive_plan",
            "artDirection": "night_discovery",
            "sceneDescription": "Narrow Kyoto street before rain, tea-house glow, wet stone.",
            "visualMotifs": ["lantern light", "narrow street"],
            "forbiddenSymbols": ["bathroom mirror"],
            "palette": ["amber", "indigo"],
            "composition": "street-level single scene",
            "lighting": "lantern light",
            "camera": "35mm",
            "typographyMood": "restrained editorial",
            "emotionalTone": ["curious"],
            "topicCategory": "travel",
            "confidence": 0.9,
        }
    )
    mapped = map_mirror_draft_to_v5_prompt(
        draft, title_source="llm_draft_approved", art_direction_source="llm_draft"
    )
    assert mapped.title == "Yağmurdan Önce Kyoto"
    assert "TITLE:" not in mapped.prompt
    assert f'"{mapped.title}"' not in mapped.prompt
    assert MIRROR_TEXT_FREE_SCENE_RULE.split(".")[0] in mapped.prompt

    provider = build_openai_mirror_prompt(
        MirrorImageRequest(
            prompt=mapped.prompt,
            negative_prompt=mapped.negativePrompt,
            seed_hint="d1-d0-reg",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-07-19",
            quality_hints=[],
            prompt_contract=V5_PROMPT_CONTRACT,
        )
    )
    assert "TITLE:" not in provider
    assert "Yağmurdan Önce Kyoto" not in provider


def test_prepare_module_still_quota_free():
    import backend.services.mirror.mirror_director_prepare as prep

    src = inspect.getsource(prep)
    assert "consume_usage_event_atomic" not in src
    assert "generate_mirror_scene" not in src
    assert "build_mirror_conversation_context_v1" in src
