# -*- coding: utf-8 -*-
"""Phase 5.2 — verified continuation parent for child Yansı publish."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.same_conversation_parent import (
    resolve_verified_continuation_parent,
)


def _published_journey(*, slug: str, window_index: int, window_end: int):
    return SimpleNamespace(
        slug=slug,
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        published_at=datetime.now(timezone.utc),
        window_index=window_index,
        window_end=window_end,
        user_id=uuid.uuid4(),
        conversation_id="conv-from-a",
    )


@pytest.mark.asyncio
async def test_window0_parent_is_originating_yansi():
    db = AsyncMock()
    user_id = uuid.uuid4()
    resolved = await resolve_verified_continuation_parent(
        db,
        origin_parent_slug="yansi-a",
        requested_parent_slug="yansi-a",
        user_id=user_id,
        conversation_id="conv-from-a",
        child_slug="journey-b",
        child_window_index=0,
        child_window_start=0,
    )
    assert resolved == "yansi-a"


@pytest.mark.asyncio
async def test_omit_requested_parent_still_uses_origin_not_root():
    db = AsyncMock()
    resolved = await resolve_verified_continuation_parent(
        db,
        origin_parent_slug="yansi-a",
        requested_parent_slug=None,
        user_id=uuid.uuid4(),
        conversation_id="conv-from-a",
        child_slug="journey-b",
        child_window_index=0,
        child_window_start=0,
    )
    assert resolved == "yansi-a"


@pytest.mark.asyncio
async def test_forged_parent_is_rejected():
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await resolve_verified_continuation_parent(
            db,
            origin_parent_slug="yansi-a",
            requested_parent_slug="yansi-c",
            user_id=uuid.uuid4(),
            conversation_id="conv-from-a",
            child_slug="journey-b",
            child_window_index=0,
            child_window_start=0,
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "journey_parent_invalid"


@pytest.mark.asyncio
async def test_later_block_uses_latest_published_prior_not_origin():
    user_id = uuid.uuid4()
    b = _published_journey(slug="journey-b", window_index=0, window_end=7)
    db = AsyncMock()

    async def _list(_db, *, user_id, conversation_id):  # noqa: ARG001
        return [b]

    from unittest.mock import patch

    with patch(
        "backend.services.mirror_network.same_conversation_parent.list_journey_nodes_for_conversation",
        new=_list,
    ):
        resolved = await resolve_verified_continuation_parent(
            db,
            origin_parent_slug="yansi-a",
            requested_parent_slug="journey-b",
            user_id=user_id,
            conversation_id="conv-from-a",
            child_slug="journey-c",
            child_window_index=1,
            child_window_start=8,
        )
    assert resolved == "journey-b"


@pytest.mark.asyncio
async def test_async_generating_falls_back_to_originating_a():
    """No published prior in conversation → C.parent = A, never root, never generating B."""
    db = AsyncMock()

    async def _list(_db, *, user_id, conversation_id):  # noqa: ARG001
        return []

    from unittest.mock import patch

    with patch(
        "backend.services.mirror_network.same_conversation_parent.list_journey_nodes_for_conversation",
        new=_list,
    ):
        resolved = await resolve_verified_continuation_parent(
            db,
            origin_parent_slug="yansi-a",
            requested_parent_slug=None,
            user_id=uuid.uuid4(),
            conversation_id="conv-from-a",
            child_slug="journey-c",
            child_window_index=1,
            child_window_start=8,
        )
    assert resolved == "yansi-a"


@pytest.mark.asyncio
async def test_later_block_forged_origin_when_b_exists_rejected():
    b = _published_journey(slug="journey-b", window_index=0, window_end=7)
    db = AsyncMock()
    from unittest.mock import patch

    async def _list(_db, *, user_id, conversation_id):  # noqa: ARG001
        return [b]

    with patch(
        "backend.services.mirror_network.same_conversation_parent.list_journey_nodes_for_conversation",
        new=_list,
    ):
        with pytest.raises(HTTPException) as exc:
            await resolve_verified_continuation_parent(
                db,
                origin_parent_slug="yansi-a",
                requested_parent_slug="yansi-a",
                user_id=uuid.uuid4(),
                conversation_id="conv-from-a",
                child_slug="journey-c",
                child_window_index=1,
                child_window_start=8,
            )
    assert exc.value.detail["code"] == "journey_parent_invalid"
