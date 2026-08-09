# -*- coding: utf-8 -*-
"""Phase 2 production closure — window identity + same-conversation parent."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.journey_publish_contract import (
    resolve_journey_publish_mode,
    validate_selected_journey_steps,
)
from backend.services.mirror_network.journey_window_contract import (
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)
from backend.services.mirror_network.same_conversation_parent import (
    resolve_same_conversation_parent,
)


def _eight_steps(start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i + 1}",
            "sourceAssistantMessageId": f"a{start + i + 1}",
            "publicQuestion": f"Soru {start + i + 1}?",
            "publicAnswer": f"Cevap {start + i + 1}.",
        }
        for i in range(8)
    ]


def test_normalize_accepts_legacy_aliases():
    legacy = [
        {
            "index": i,
            "sourceOrder": i - 1,
            "userMessageId": f"u{i}",
            "assistantMessageId": f"a{i}",
            "publicQuestion": f"Soru {i}?",
            "publicAnswer": f"Cevap {i}.",
        }
        for i in range(1, 9)
    ]
    rows = normalize_selected_journey_steps(legacy)
    assert rows[0]["stepIndex"] == 1
    assert rows[0]["sourceOrder"] == 0


def test_window_identity_ok_window0():
    steps = normalize_selected_journey_steps(_eight_steps(0))
    assert validate_journey_window_identity(
        window_index=0, window_start=0, window_end=7, steps=steps
    ) == (0, 0, 7)


def test_window_identity_ok_window1():
    steps = normalize_selected_journey_steps(_eight_steps(8))
    assert validate_journey_window_identity(
        window_index=1, window_start=8, window_end=15, steps=steps
    ) == (1, 8, 15)


def test_window_mismatch_rejects():
    steps = normalize_selected_journey_steps(_eight_steps(0))
    with pytest.raises(HTTPException) as exc:
        validate_journey_window_identity(
            window_index=0, window_start=0, window_end=6, steps=steps
        )
    assert exc.value.detail["code"] == "journey_window_contract_invalid"


def test_source_order_must_match_declared_window():
    steps = normalize_selected_journey_steps(_eight_steps(0))
    with pytest.raises(HTTPException) as exc:
        validate_journey_window_identity(
            window_index=1, window_start=8, window_end=15, steps=steps
        )
    assert exc.value.detail["code"] == "journey_window_contract_invalid"


def test_resolve_mode_requires_window_for_journey():
    with pytest.raises(HTTPException) as exc:
        resolve_journey_publish_mode(
            conversation_id="conv-1",
            journey_id_raw="journey-a",
            selected_steps=_eight_steps(0),
            flag_enabled=True,
        )
    assert exc.value.detail["code"] == "journey_window_contract_invalid"


def test_resolve_mode_with_window():
    mode, jid, steps, window = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw="journey-a",
        selected_steps=_eight_steps(0),
        window_index=0,
        window_start=0,
        window_end=7,
        flag_enabled=True,
    )
    assert mode == "journey"
    assert jid == "journey-a"
    assert len(steps) == 8
    assert window == (0, 0, 7)


def test_validate_selected_steps_accepts_six_to_eight():
    six = normalize_selected_journey_steps(_eight_steps(0)[:6])
    assert len(six) == 6
    assert [s["stepIndex"] for s in six] == [1, 2, 3, 4, 5, 6]

    with pytest.raises(HTTPException) as exc:
        validate_selected_journey_steps(_eight_steps(0)[:5])
    assert exc.value.detail["code"] == "journey_steps_required"


def test_subset_selection_inside_block_ok():
    # Deselect sourceOrder 1 and 3 from block 0 → 6 steps with gaps
    raw = [
        {
            "stepIndex": i + 1,
            "sourceOrder": order,
            "sourceUserMessageId": f"u{order + 1}",
            "sourceAssistantMessageId": f"a{order + 1}",
            "publicQuestion": f"Soru {order + 1}?",
            "publicAnswer": f"Cevap {order + 1}.",
        }
        for i, order in enumerate([0, 2, 4, 5, 6, 7])
    ]
    steps = normalize_selected_journey_steps(raw)
    assert validate_journey_window_identity(
        window_index=0, window_start=0, window_end=7, steps=steps
    ) == (0, 0, 7)


def test_cross_block_selection_rejected():
    cross = [
        {
            "stepIndex": i + 1,
            "sourceOrder": order,
            "sourceUserMessageId": f"u{order}",
            "sourceAssistantMessageId": f"a{order}",
            "publicQuestion": f"Q{order}?",
            "publicAnswer": f"A{order}.",
        }
        for i, order in enumerate([0, 1, 2, 3, 4, 8])
    ]
    steps = normalize_selected_journey_steps(cross)
    with pytest.raises(HTTPException) as exc:
        validate_journey_window_identity(
            window_index=0, window_start=0, window_end=7, steps=steps
        )
    assert exc.value.detail["code"] == "journey_window_contract_invalid"
    assert exc.value.detail.get("reason") == "cross_block_selection"


def test_high_block_index_ok():
    steps = normalize_selected_journey_steps(_eight_steps(24))
    assert validate_journey_window_identity(
        window_index=3, window_start=24, window_end=31, steps=steps
    ) == (3, 24, 31)


def test_flag_off_legacy():
    mode, jid, steps, window = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw=None,
        selected_steps=None,
        flag_enabled=False,
    )
    assert mode == "legacy"
    assert jid is None
    assert steps is None
    assert window is None


@pytest.mark.asyncio
async def test_same_conversation_parent_accepts_latest(monkeypatch):
    owner = uuid4()
    parent = SimpleNamespace(
        slug="journey-a",
        user_id=owner,
        conversation_id="conv-1",
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        published_at=datetime.now(timezone.utc),
        window_index=0,
        window_end=7,
    )

    async def _get_slug(_db, slug):
        return parent if slug == "journey-a" else None

    async def _list(_db, *, user_id, conversation_id):
        assert user_id == owner
        assert conversation_id == "conv-1"
        return [parent]

    monkeypatch.setattr(
        "backend.services.mirror_network.same_conversation_parent.get_mirror_network_node_by_slug",
        _get_slug,
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.same_conversation_parent.list_journey_nodes_for_conversation",
        _list,
    )

    result = await resolve_same_conversation_parent(
        db=None,  # type: ignore[arg-type]
        user_id=owner,
        conversation_id="conv-1",
        requested_parent_slug="journey-a",
        child_slug="journey-b",
        child_window_index=1,
        child_window_start=8,
    )
    assert result == "journey-a"


@pytest.mark.asyncio
async def test_same_conversation_wrong_parent_rejected(monkeypatch):
    owner = uuid4()
    late = SimpleNamespace(
        slug="journey-late",
        user_id=owner,
        conversation_id="conv-1",
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        published_at=datetime.now(timezone.utc),
        window_index=1,
        window_end=15,
    )

    async def _get_slug(_db, slug):
        return late if slug == "journey-late" else None

    monkeypatch.setattr(
        "backend.services.mirror_network.same_conversation_parent.get_mirror_network_node_by_slug",
        _get_slug,
    )

    with pytest.raises(HTTPException) as exc:
        await resolve_same_conversation_parent(
            db=None,  # type: ignore[arg-type]
            user_id=owner,
            conversation_id="conv-1",
            requested_parent_slug="journey-late",
            child_slug="journey-b",
            child_window_index=1,
            child_window_start=8,
        )
    assert exc.value.detail["code"] == "journey_parent_invalid"


@pytest.mark.asyncio
async def test_cross_user_parent_requires_proof(monkeypatch):
    owner = uuid4()
    other = uuid4()
    parent = SimpleNamespace(
        slug="journey-a",
        user_id=other,
        conversation_id="conv-1",
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        published_at=datetime.now(timezone.utc),
        window_index=0,
        window_end=7,
    )

    async def _get_slug(_db, slug):
        return parent

    monkeypatch.setattr(
        "backend.services.mirror_network.same_conversation_parent.get_mirror_network_node_by_slug",
        _get_slug,
    )

    with pytest.raises(HTTPException) as exc:
        await resolve_same_conversation_parent(
            db=None,  # type: ignore[arg-type]
            user_id=owner,
            conversation_id="conv-1",
            requested_parent_slug="journey-a",
            child_slug="journey-b",
            child_window_index=1,
            child_window_start=8,
        )
    assert exc.value.detail["code"] == "lineage_proof_required"
