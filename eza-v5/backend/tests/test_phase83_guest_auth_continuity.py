# -*- coding: utf-8 -*-
"""Phase 8.3 — guest claim authorization / idempotency."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from backend.services.conversation_tree.groups import claim_guest_conversation_groups
from backend.services.mirror_network.sohbet_session import guest_token_fingerprint


def _fake_row(*, title: str, guest_token: str | None = None, user_id=None):
    return SimpleNamespace(
        id=uuid4(),
        title=title,
        guest_token=guest_token,
        user_id=user_id,
        source="mirror",
        parent_group_id=None,
        created_at=None,
        updated_at=None,
        sort_order=0,
    )


def test_claim_clears_guest_token_after_assign():
    user_id = uuid4()
    guest_fp = guest_token_fingerprint("guest-token-abcdefghijklmnop")
    guest_row = _fake_row(title="Kyoto", guest_token=guest_fp, user_id=None)

    mock_db = AsyncMock()
    guest_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [guest_row]))
    user_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    mock_db.execute = AsyncMock(side_effect=[guest_result, user_result])
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    claimed, merged = asyncio.run(
        claim_guest_conversation_groups(
            mock_db,
            user_id=user_id,
            guest_token="guest-token-abcdefghijklmnop",
        )
    )

    assert merged == 0
    assert len(claimed) == 1
    assert claimed[0].user_id == user_id
    assert claimed[0].guest_token is None


def test_claim_idempotent_when_no_guest_rows_remain():
    user_id = uuid4()
    mock_db = AsyncMock()
    empty = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    mock_db.execute = AsyncMock(return_value=empty)

    claimed, merged = asyncio.run(
        claim_guest_conversation_groups(
            mock_db,
            user_id=user_id,
            guest_token="guest-token-abcdefghijklmnop",
        )
    )
    assert claimed == []
    assert merged == 0


def test_guest_token_fingerprint_is_stable_and_not_raw():
    raw = "guest-token-abcdefghijklmnop"
    fp = guest_token_fingerprint(raw)
    assert fp != raw
    assert len(fp) == 32
    assert guest_token_fingerprint(raw) == fp
