# -*- coding: utf-8 -*-
"""Tests for Standalone Chat request-level memory helpers."""

import pytest
from unittest.mock import patch, AsyncMock

from backend.api.standalone_chat_memory import (
    MAX_HISTORY_MESSAGES,
    MAX_HISTORY_TOTAL_CHARS,
    build_standalone_llm_messages,
    flatten_history_to_prompt,
    normalize_history,
    serialized_history_text,
)


def test_empty_history_single_user_message():
    messages = build_standalone_llm_messages("Merhaba", None)
    assert messages == [{"role": "user", "content": "Merhaba"}]


def test_uzbekistan_seven_day_route_scenario():
    history = [
        {"role": "user", "content": "Özbekistan'da nereler gezilir?"},
        {
            "role": "assistant",
            "content": "Semerkant, Buhara ve Taşkent öne çıkan duraklardır.",
        },
    ]
    query = "Bana 7 günlük rota oluştur."
    messages = build_standalone_llm_messages(query, history)

    assert len(messages) == 3
    assert messages[0]["role"] == "user"
    assert "Özbekistan" in messages[0]["content"]
    assert messages[1]["role"] == "assistant"
    assert messages[2] == {"role": "user", "content": query}


def test_query_not_duplicated_in_history():
    history = [
        {"role": "user", "content": "Bana 7 günlük rota oluştur."},
    ]
    query = "Bana 7 günlük rota oluştur."
    normalized = normalize_history(history, current_query=query)
    assert normalized == []

    messages = build_standalone_llm_messages(query, history)
    assert messages == [{"role": "user", "content": query}]


def test_history_truncated_to_max_messages():
    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg-{i}"}
        for i in range(20)
    ]
    normalized = normalize_history(history, max_messages=MAX_HISTORY_MESSAGES)
    assert len(normalized) == MAX_HISTORY_MESSAGES
    assert normalized[0]["content"] == "msg-10"
    assert normalized[-1]["content"] == "msg-19"


def test_history_truncated_by_char_budget():
    long_content = "x" * 500
    history = [
        {"role": "user", "content": long_content},
        {"role": "assistant", "content": long_content},
        {"role": "user", "content": long_content},
        {"role": "assistant", "content": long_content},
        {"role": "user", "content": long_content},
        {"role": "assistant", "content": long_content},
        {"role": "user", "content": long_content},
        {"role": "assistant", "content": "keep-me"},
    ]
    normalized = normalize_history(
        history,
        max_messages=10,
        max_total_chars=MAX_HISTORY_TOTAL_CHARS,
    )
    total = sum(len(m["content"]) for m in normalized)
    assert total <= MAX_HISTORY_TOTAL_CHARS
    assert normalized[-1]["content"] == "keep-me"


def test_invalid_roles_filtered():
    history = [
        {"role": "system", "content": "ignore"},
        {"role": "user", "content": "valid"},
        {"role": "assistant", "content": ""},
    ]
    normalized = normalize_history(history)
    assert normalized == [{"role": "user", "content": "valid"}]


def test_flatten_history_for_non_openai_providers():
    history = [
        {"role": "user", "content": "Özbekistan'da nereler gezilir?"},
        {"role": "assistant", "content": "Semerkant ve Buhara."},
    ]
    prompt = flatten_history_to_prompt("Bana 7 günlük rota oluştur.", history)
    assert "Önceki konuşma:" in prompt
    assert "Özbekistan" in prompt
    assert "Şimdiki soru: Bana 7 günlük rota oluştur." in prompt


def test_serialized_history_text_for_quota():
    history = [{"role": "user", "content": "prior"}]
    text = serialized_history_text("current", history)
    assert "prior" in text
    assert "current" in text


@pytest.mark.asyncio
async def test_stream_scoring_uses_query_only_not_history():
    """analyze_input must receive only the current query, not prior turns."""
    from backend.api.streaming import stream_standalone_response

    history = [
        {"role": "user", "content": "risky prior content should not be analyzed"},
        {"role": "assistant", "content": "prior answer"},
    ]
    captured_queries = []

    def fake_analyze_input(text):
        captured_queries.append(text)
        return {"risk_score": 0.1, "risk_level": "low", "intent": "info", "risk_flags": []}

    async def fake_stream_llm(*_args, **_kwargs):
        yield "test "

    with patch("backend.api.streaming.analyze_input", side_effect=fake_analyze_input), patch(
        "backend.api.streaming._stream_llm_response", side_effect=fake_stream_llm
    ):
        chunks = []
        async for chunk in stream_standalone_response(
            query="Bana 7 günlük rota oluştur.",
            chat_history=history,
        ):
            chunks.append(chunk)

    assert captured_queries == ["Bana 7 günlük rota oluştur."]


@pytest.mark.asyncio
async def test_safe_only_rewrite_receives_query_only():
    """safe_rewrite user_message must be the current query only."""
    from backend.api.streaming import stream_standalone_response

    history = [{"role": "user", "content": "old question"}]
    rewrite_calls = []

    def fake_analyze_input(_text):
        return {"risk_score": 0.0, "risk_level": "low", "intent": "info", "risk_flags": []}

    def fake_safe_rewrite(user_message, **_kwargs):
        rewrite_calls.append(user_message)
        return "safe answer"

    with patch("backend.api.streaming.analyze_input", side_effect=fake_analyze_input), patch(
        "backend.api.streaming._get_llm_response", new_callable=AsyncMock, return_value="raw"
    ), patch("backend.api.streaming.analyze_output", return_value={}), patch(
        "backend.api.streaming.compute_alignment", return_value={}
    ), patch(
        "backend.api.streaming.safe_rewrite", side_effect=fake_safe_rewrite
    ):
        async for _ in stream_standalone_response(
            query="current turn",
            safe_only=True,
            chat_history=history,
        ):
            pass

    assert rewrite_calls == ["current turn"]
