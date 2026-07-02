# -*- coding: utf-8 -*-
"""parent_slug validation and immutability (Faz 2.1)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest
from backend.services.mirror_network.parent_lineage import (
    resolve_stored_parent_slug,
    validate_parent_slug,
)
from backend.services.mirror_network.publish import publish_mirror_to_network
from backend.tests.test_mirror_network_publish import _make_user, _publish_body


def _parent_node(*, slug: str, visibility: str = "public", safety_status: str = "open"):
    return SimpleNamespace(
        slug=slug,
        visibility=visibility,
        safety_status=safety_status,
        parent_slug=None,
    )


@pytest.mark.asyncio
async def test_validate_parent_slug_rejects_missing_parent():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.parent_lineage.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=None),
    ):
        with pytest.raises(HTTPException) as exc:
            await validate_parent_slug(db, parent_slug="missing-parent", child_slug="child-slug")
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "parent_not_found"


@pytest.mark.asyncio
async def test_validate_parent_slug_rejects_self_parent():
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await validate_parent_slug(db, parent_slug="same-slug", child_slug="same-slug")
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "invalid_parent_slug"


@pytest.mark.asyncio
async def test_validate_parent_slug_rejects_private_parent():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.parent_lineage.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=_parent_node(slug="private-parent", visibility="private")),
    ):
        with pytest.raises(HTTPException) as exc:
            await validate_parent_slug(db, parent_slug="private-parent", child_slug="child-slug")
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "parent_not_eligible"


@pytest.mark.asyncio
async def test_validate_parent_slug_rejects_restricted_parent():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.parent_lineage.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=_parent_node(slug="restricted-parent", safety_status="restricted")),
    ):
        with pytest.raises(HTTPException) as exc:
            await validate_parent_slug(
                db, parent_slug="restricted-parent", child_slug="child-slug"
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_validate_parent_slug_accepts_public_parent():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.parent_lineage.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=_parent_node(slug="parent-ayna-abc123")),
    ):
        resolved = await validate_parent_slug(
            db, parent_slug="parent-ayna-abc123", child_slug="child-ayna-xyz"
        )
    assert resolved == "parent-ayna-abc123"


def test_resolve_stored_parent_slug_keeps_existing_parent():
    assert resolve_stored_parent_slug(
        existing_parent_slug="original-parent",
        validated_parent_slug="new-parent",
    ) == "original-parent"


def test_resolve_stored_parent_slug_sets_validated_when_empty():
    assert resolve_stored_parent_slug(
        existing_parent_slug=None,
        validated_parent_slug="parent-ayna-abc123",
    ) == "parent-ayna-abc123"


@pytest.mark.asyncio
async def test_publish_rejects_invalid_parent_slug():
    user = _make_user()
    db = AsyncMock()
    body = _publish_body()
    body["parentSlug"] = "fake-parent-slug"

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
            "backend.services.mirror_network.publish.validate_parent_slug",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=400,
                    detail={"code": "parent_not_found", "message": "missing"},
                )
            ),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await publish_mirror_to_network(
                db,
                user,
                MirrorNetworkPublishRequest.model_validate(body),
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_publish_retry_does_not_change_existing_parent_slug():
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
            "backend.services.mirror_network.publish.validate_parent_slug",
            new=AsyncMock(return_value="attacker-parent"),
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=existing),
        ),
    ):
        body = _publish_body()
        body["parentSlug"] = "attacker-parent"
        await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    assert existing.parent_slug == "original-parent"


@pytest.mark.asyncio
async def test_publish_retry_ignores_invalid_parent_when_existing_parent_set():
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
            "backend.services.mirror_network.publish.validate_parent_slug",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=400,
                    detail={"code": "parent_not_found", "message": "missing"},
                )
            ),
        ) as mock_validate,
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=existing),
        ),
    ):
        body = _publish_body()
        body["parentSlug"] = "fake-parent-slug"
        await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    mock_validate.assert_not_awaited()
    assert existing.parent_slug == "original-parent"


@pytest.mark.asyncio
async def test_publish_persists_valid_parent_slug_on_first_publish():
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
            "backend.services.mirror_network.publish.validate_parent_slug",
            new=AsyncMock(return_value="parent-ayna-abc123"),
        ),
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
        body["parentSlug"] = "parent-ayna-abc123"
        await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    assert captured["node"].parent_slug == "parent-ayna-abc123"
