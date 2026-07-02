# -*- coding: utf-8 -*-
"""Shared sensitive content detection tests."""

from __future__ import annotations

import pytest

from backend.core.privacy.sensitive_content import contains_pii_value


def test_safe_public_urls_not_flagged():
    assert contains_pii_value("https://saina.app/m/sokak-lambalari-abc123") is False
    assert contains_pii_value("https://cdn.example/mirror-scene.jpg") is False


def test_rejects_openai_style_key():
    assert contains_pii_value("sk-proj-abcdefghijklmnopqrstuvwxyz123456") is True
    assert contains_pii_value("prefix sk-abc1234567890abcdef suffix") is True


def test_rejects_bearer_token():
    assert contains_pii_value("Bearer abcdefghijklmnopqrstuvwxyz123456") is True


def test_rejects_credential_query_pattern():
    assert contains_pii_value("api_key=supersecretvalue1234567890") is True
    assert contains_pii_value("https://cdn.example/x?access_token=abcdef1234567890") is True


def test_rejects_embedded_tc_kimlik():
    assert contains_pii_value("TC: 12345678901") is True
    assert contains_pii_value("Kimlik no 12345678901 ile") is True


def test_rejects_long_opaque_secret():
    assert contains_pii_value("x" * 40) is True
