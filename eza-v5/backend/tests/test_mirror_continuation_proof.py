# -*- coding: utf-8 -*-
"""Server-verified mirror continuation proofs (Faz 2.2)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest
from backend.services.mirror_network.continuation_proof import (
    actor_hash_for_guest_token,
    atomically_consume_continuation_proof,
    count_verified_continuation_starts,
    create_continuation_proof,
    resolve_parent_slug_from_proof,
)
from backend.services.mirror_network.publish import publish_mirror_to_network
from backend.tests.test_mirror_network_publish import _make_user, _publish_body


def _proof_row(
    *,
    proof_id: uuid.UUID | None = None,
    source_slug: str = "parent-ayna-abc123",
    session_id: str = "session-1",
    guest_token: str = "guest-token-abcdefghijklmnop",
    consumed_at=None,
    conversation_id: str | None = None,
    user_id=None,
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=proof_id or uuid.uuid4(),
        source_mirror_slug=source_slug,
        session_id=session_id,
        actor_hash=actor_hash_for_guest_token(guest_token),
        user_id=user_id,
        conversation_id=conversation_id,
        consumed_at=consumed_at,
        expires_at=now + timedelta(hours=72),
        created_at=now,
    )


@pytest.mark.asyncio
async def test_create_continuation_proof_persists_actor_hash():
    db = AsyncMock()
    captured: dict = {}

    def _capture_add(row):
        captured["proof"] = row

    db.add = _capture_add
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    with patch(
        "backend.services.mirror_network.continuation_proof.MirrorContinuationProof",
        side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
    ):
        proof = await create_continuation_proof(
            db,
            source_mirror_slug="parent-ayna-abc123",
            session_id="session-abc",
            guest_token="guest-token-abcdefghijklmnop",
        )

    assert captured["proof"].source_mirror_slug == "parent-ayna-abc123"
    assert captured["proof"].actor_hash == actor_hash_for_guest_token(
        "guest-token-abcdefghijklmnop"
    )
    assert proof.source_mirror_slug == "parent-ayna-abc123"


@pytest.mark.asyncio
async def test_resolve_parent_slug_from_proof_accepts_matching_guest():
    proof = _proof_row()
    db = AsyncMock()
    db.commit = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
            new=AsyncMock(return_value=proof),
        ),
        patch(
            "backend.services.mirror_network.continuation_proof.validate_parent_slug",
            new=AsyncMock(return_value="parent-ayna-abc123"),
        ),
        patch(
            "backend.services.mirror_network.continuation_proof.atomically_consume_continuation_proof",
            new=AsyncMock(return_value=proof),
        ) as mock_atomic,
    ):
        parent = await resolve_parent_slug_from_proof(
            db,
            proof_token=str(proof.id),
            user_id=uuid.uuid4(),
            guest_token="guest-token-abcdefghijklmnop",
            conversation_id="chat-mirror-1",
            child_slug="child-ayna-xyz",
            consume=True,
        )

    assert parent == "parent-ayna-abc123"
    mock_atomic.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_parent_slug_from_proof_rejects_actor_mismatch():
    proof = _proof_row()
    db = AsyncMock()

    with patch(
        "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
        new=AsyncMock(return_value=proof),
    ):
        with pytest.raises(HTTPException) as exc:
            await resolve_parent_slug_from_proof(
                db,
                proof_token=str(proof.id),
                user_id=uuid.uuid4(),
                guest_token="other-guest-token-abcdefghijklmnop",
                conversation_id="chat-mirror-1",
                child_slug="child-ayna-xyz",
                consume=True,
            )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "lineage_proof_forbidden"


@pytest.mark.asyncio
async def test_resolve_parent_slug_from_proof_rejects_consumed_proof():
    proof = _proof_row(consumed_at=datetime.now(timezone.utc), conversation_id="other-chat")
    db = AsyncMock()

    with patch(
        "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
        new=AsyncMock(return_value=proof),
    ):
        with pytest.raises(HTTPException) as exc:
            await resolve_parent_slug_from_proof(
                db,
                proof_token=str(proof.id),
                user_id=uuid.uuid4(),
                guest_token="guest-token-abcdefghijklmnop",
                conversation_id="chat-mirror-1",
                child_slug="child-ayna-xyz",
                consume=True,
            )
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "lineage_proof_consumed"


@pytest.mark.asyncio
async def test_count_verified_continuation_starts_distinct_actors():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(scalar=lambda: 3))
    assert await count_verified_continuation_starts(db, "parent-ayna-abc123") == 3


@pytest.mark.asyncio
async def test_publish_rejects_parent_slug_without_proof():
    user = _make_user()
    db = AsyncMock()
    body = _publish_body()
    body["parentSlug"] = "parent-ayna-abc123"

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new=AsyncMock(return_value=False),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await publish_mirror_to_network(
                db,
                user,
                MirrorNetworkPublishRequest.model_validate(body),
            )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "lineage_proof_required"


@pytest.mark.asyncio
async def test_publish_uses_proof_instead_of_client_parent_slug():
    user = _make_user()
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    captured: dict = {}

    async def _capture_create(_db, node):
        captured["node"] = node
        return node

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "backend.services.mirror_network.publish.resolve_parent_slug_from_proof",
            new=AsyncMock(return_value="parent-ayna-abc123"),
        ) as mock_proof,
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new=AsyncMock(side_effect=_capture_create),
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
    ):
        body = _publish_body()
        body["lineageProofToken"] = str(uuid.uuid4())
        body["guestToken"] = "guest-token-abcdefghijklmnop"
        body["parentSlug"] = "attacker-parent"
        await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    mock_proof.assert_awaited_once()
    assert captured["node"].parent_slug == "parent-ayna-abc123"


@pytest.mark.asyncio
async def test_atomically_consume_returns_none_when_already_consumed():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None))
    proof_id = uuid.uuid4()
    result = await atomically_consume_continuation_proof(
        db,
        proof_id=proof_id,
        user_id=uuid.uuid4(),
        conversation_id="chat-1",
    )
    assert result is None
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_resolve_parent_slug_from_proof_idempotent_same_conversation():
    proof = _proof_row(
        consumed_at=datetime.now(timezone.utc),
        conversation_id="chat-mirror-1",
    )
    db = AsyncMock()

    with patch(
        "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
        new=AsyncMock(return_value=proof),
    ):
        parent = await resolve_parent_slug_from_proof(
            db,
            proof_token=str(proof.id),
            user_id=uuid.uuid4(),
            guest_token="guest-token-abcdefghijklmnop",
            conversation_id="chat-mirror-1",
            child_slug="child-ayna-xyz",
            consume=True,
        )

    assert parent == "parent-ayna-abc123"


@pytest.mark.asyncio
async def test_resolve_parent_slug_from_proof_blocks_second_conversation_after_race():
    proof = _proof_row()
    consumed = _proof_row(
        proof_id=proof.id,
        consumed_at=datetime.now(timezone.utc),
        conversation_id="chat-first",
    )
    db = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
            new=AsyncMock(side_effect=[proof, consumed]),
        ),
        patch(
            "backend.services.mirror_network.continuation_proof.validate_parent_slug",
            new=AsyncMock(return_value="parent-ayna-abc123"),
        ),
        patch(
            "backend.services.mirror_network.continuation_proof.atomically_consume_continuation_proof",
            new=AsyncMock(return_value=None),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await resolve_parent_slug_from_proof(
                db,
                proof_token=str(proof.id),
                user_id=uuid.uuid4(),
                guest_token="guest-token-abcdefghijklmnop",
                conversation_id="chat-second",
                child_slug="child-ayna-xyz",
                consume=True,
            )
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "lineage_proof_consumed"


@pytest.mark.asyncio
async def test_publish_retry_skips_proof_consume_when_node_exists():
    user = _make_user()
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        slug="child-ayna-abc123",
        user_id=user.id,
        conversation_id="conv-publish-1",
        visibility="public",
        safety_status="open",
        card_title="Sokak Lambaları",
        card_date="2026-05-31",
        scene_image_url="https://cdn.example/existing-scene.jpg",
        public_payload={"sceneImageUrl": "https://cdn.example/existing-scene.jpg"},
        private_payload={},
        parent_slug="original-parent",
        published_at=None,
        created_at=None,
    )
    db = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(return_value=existing),
        ),
        patch(
            "backend.services.mirror_network.publish.resolve_parent_slug_from_proof",
            new=AsyncMock(),
        ) as mock_proof,
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=existing),
        ),
    ):
        body = _publish_body()
        body["lineageProofToken"] = str(uuid.uuid4())
        body["guestToken"] = "guest-token-abcdefghijklmnop"
        await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    mock_proof.assert_not_awaited()
    assert existing.parent_slug == "original-parent"
