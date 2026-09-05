# -*- coding: utf-8 -*-
"""Unit tests for optional groupId parsing — Phase 8.8G-5 / 2.2."""

from __future__ import annotations

import uuid

from backend.services.standalone.group_id import parse_optional_group_uuid


def test_parse_optional_group_uuid_none_and_empty():
    assert parse_optional_group_uuid(None) == (None, False)
    assert parse_optional_group_uuid("") == (None, False)
    assert parse_optional_group_uuid("   ") == (None, False)


def test_parse_optional_group_uuid_valid():
    gid = str(uuid.uuid4())
    parsed, sanitized = parse_optional_group_uuid(gid)
    assert sanitized is False
    assert parsed is not None
    assert str(parsed) == gid


def test_parse_optional_group_uuid_legacy_local_sanitized():
    parsed, sanitized = parse_optional_group_uuid("group-1710000000-abc123")
    assert parsed is None
    assert sanitized is True
