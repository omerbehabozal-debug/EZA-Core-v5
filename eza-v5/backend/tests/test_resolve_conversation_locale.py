# -*- coding: utf-8 -*-
"""Conversation locale resolver for D2 / public landing."""

from __future__ import annotations

from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO
from backend.services.mirror.resolve_conversation_locale import resolve_conversation_locale


def _msg(role: str, text: str) -> MirrorConversationMessageDTO:
    return MirrorConversationMessageDTO(role=role, text=text, sequence=0)  # type: ignore[arg-type]


def test_resolve_locale_turkish_chars():
    assert (
        resolve_conversation_locale(
            [_msg("user", "Mardin'de hiç olmadım, sarı taş sokakları merak ediyorum.")]
        )
        == "tr"
    )


def test_resolve_locale_english_cues():
    assert (
        resolve_conversation_locale(
            [_msg("user", "I am looking for the right family SUV between BMW and Mercedes.")]
        )
        == "en"
    )


def test_resolve_locale_arabic_script():
    assert resolve_conversation_locale([_msg("user", "مرحبا أريد السفر إلى ماردين")]) == "ar"


def test_resolve_locale_explicit_override():
    assert (
        resolve_conversation_locale(
            [_msg("user", "I want travel")],
            explicit="tr",
        )
        == "tr"
    )
