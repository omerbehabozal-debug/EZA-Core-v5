# -*- coding: utf-8 -*-
"""Tests for visual quota source_id / idempotency keys."""

import pytest

from backend.core.account.visual_source import (
    VisualSourceIdError,
    build_visual_source_id,
    content_hash_for_visual,
)


def test_build_visual_source_id_prefers_request_id():
    key = build_visual_source_id(
        conversation_id="conv-1",
        generation_request_id="req-abcdef12",
        card_date="2026-05-21",
    )
    assert key == "visual:conv-1:req-abcdef12"


def test_build_visual_source_id_guest_scope():
    key = build_visual_source_id(
        conversation_id=None,
        generation_request_id="req-abcdef12",
        guest_scope="guest-fp-abc",
    )
    assert key == "visual:guest:guest-fp-abc:req-abcdef12"


def test_same_day_different_request_ids_are_distinct():
    first = build_visual_source_id(
        conversation_id="conv-1",
        generation_request_id="req-11111111",
        card_date="2026-05-21",
    )
    second = build_visual_source_id(
        conversation_id="conv-1",
        generation_request_id="req-22222222",
        card_date="2026-05-21",
    )
    assert first != second


def test_card_date_alone_is_not_valid_source_id():
    with pytest.raises(VisualSourceIdError):
        build_visual_source_id(
            conversation_id=None,
            generation_request_id=None,
            card_date="2026-05-21",
        )


def test_fallback_uses_content_hash_not_date_only():
    digest = content_hash_for_visual(
        prompt="calm scene",
        seed_hint="seed-1",
        style_preset="eza_mirror_professional_v1",
    )
    key = build_visual_source_id(
        conversation_id="conv-1",
        generation_request_id=None,
        card_date="2026-05-21",
        content_hash=digest,
    )
    assert key == f"visual:conv-1:2026-05-21:{digest}"
