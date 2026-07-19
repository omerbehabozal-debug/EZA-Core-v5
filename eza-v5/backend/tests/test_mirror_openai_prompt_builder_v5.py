# -*- coding: utf-8 -*-
"""Tests for V5 minimal vs legacy OpenAI mirror prompt builder."""

from backend.services.mirror.openai_prompt_builder import (
    MAX_V5_MINIMAL_PROMPT_LEN,
    V5_PROMPT_CONTRACT,
    V5_RENDER_CONTRACT_MARKER,
    build_openai_mirror_prompt,
    build_openai_mirror_prompt_result,
    detect_legacy_blocks,
)
from backend.services.mirror.types import MirrorImageRequest

V5_SAMPLE_PROMPT = """Create a natural cinematic scene with no text, typography, captions, title, logo, watermark, labels, UI, poster layout, or readable signage. Use abstract or illegible signage only when architecturally necessary.

CATEGORY:
travel

TOPIC HINT:
Japan travel atmosphere

RENDER BRIEF:
Quiet luxury travel editorial. Natural light."""


def _v5_request(prompt: str = V5_SAMPLE_PROMPT, **kwargs) -> MirrorImageRequest:
    return MirrorImageRequest(
        prompt=prompt,
        negative_prompt="collage, dashboard, infographic",
        seed_hint="conversationMirrorV3:refinement:5.0:test",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-31",
        quality_hints=["photographic realism", "premium magazine cover"],
        prompt_contract=kwargs.get("prompt_contract", V5_PROMPT_CONTRACT),
    )


def _legacy_request() -> MirrorImageRequest:
    return MirrorImageRequest(
        prompt="premium soft 3D illustration, wellness garden, no text",
        negative_prompt="text, letters, logo",
        seed_hint="mirror-visual-abc123",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=["9:16 vertical safe composition"],
    )


def test_v5_minimal_prompt_passthrough_no_legacy_appends():
    req = _v5_request()
    result = build_openai_mirror_prompt_result(req)
    combined = result.prompt

    assert result.v5_minimal is True
    assert result.appended_sections == []
    assert "Avoid:" not in combined
    assert "Quality:" not in combined
    assert "Style:" not in combined
    assert "eza_mirror_professional_v1" not in combined
    assert "collage" not in combined
    assert combined.strip() == V5_SAMPLE_PROMPT.strip()
    assert len(combined) <= MAX_V5_MINIMAL_PROMPT_LEN
    assert detect_legacy_blocks(combined)["containsLegacyAvoid"] is False


def test_v5_detected_by_marker_without_contract_field():
    prompt_with_marker = f"{V5_SAMPLE_PROMPT}\n\n{V5_RENDER_CONTRACT_MARKER}"
    req = MirrorImageRequest(
        prompt=prompt_with_marker,
        negative_prompt="collage",
        seed_hint="seed",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-31",
        quality_hints=["photographic realism"],
        prompt_contract=None,
    )
    combined = build_openai_mirror_prompt(req)

    assert V5_RENDER_CONTRACT_MARKER not in combined
    assert "Avoid:" not in combined
    assert combined.strip() == V5_SAMPLE_PROMPT.strip()


def test_v5_health_abstract_safe_passthrough():
    health_prompt = """Create a premium editorial SAINA Mirror poster.

TOPIC HINT:
Thyroid health curiosity

Safety mode:
Premium health editorial only. Calm, dignified — never alarming."""
    req = _v5_request(prompt=health_prompt)
    combined = build_openai_mirror_prompt(req)

    assert "Avoid:" not in combined
    assert "never alarming" in combined
    assert "before/after" not in combined or "No clinical" in combined


def test_legacy_prompt_still_appends_avoid_quality_style():
    req = _legacy_request()
    result = build_openai_mirror_prompt_result(req)
    combined = result.prompt

    assert result.v5_minimal is False
    assert "Avoid:" in combined
    assert "Quality:" in combined
    assert "eza_mirror_professional_v1" in combined
    assert set(result.appended_sections) == {"Avoid", "Quality", "Style"}


def test_v5_truncates_and_flags_when_over_limit():
    long_prompt = "A" * (MAX_V5_MINIMAL_PROMPT_LEN + 50)
    req = _v5_request(prompt=long_prompt)
    result = build_openai_mirror_prompt_result(req)

    assert result.truncated is True
    assert len(result.prompt) == MAX_V5_MINIMAL_PROMPT_LEN
