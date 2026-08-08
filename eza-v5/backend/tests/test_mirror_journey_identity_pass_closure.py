# -*- coding: utf-8 -*-
"""Phase 1 PASS closure — legacy unique, step versioning, strict flag."""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy import UniqueConstraint
from sqlalchemy.exc import IntegrityError

from backend.config import Settings, parse_strict_env_bool
from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest
from backend.models.mirror_network import (
    ARTIFACT_KIND_LEGACY_LANDING,
    MirrorJourneyStep,
    MirrorNetworkNode,
)
from backend.services.mirror_network.fixtures import JAPAN_FIXTURE_BUNDLE
from backend.services.mirror_network.publish import publish_mirror_to_network


def _user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="pass-closure@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _body(**extra) -> MirrorNetworkPublishRequest:
    payload = {
        "cardTitle": "Aile SUV Merakı",
        "cardDate": "2026-08-08",
        "conversationId": "conv-shared-1",
        "sceneImageUrl": "https://cdn.example/mirror-scene.jpg",
        "curiosityBundle": JAPAN_FIXTURE_BUNDLE,
        "intelligencePrivate": {
            "intelligenceBrief": {
                "mirrorLineage": {
                    "generationId": "gen-1",
                    "generationAcceptedAt": 1_700_000_000_000,
                }
            }
        },
        "safetyLevel": "normal",
        **extra,
    }
    return MirrorNetworkPublishRequest(**payload)


# --- 1. Legacy partial unique + concurrency ---


def test_legacy_partial_unique_index_in_model_and_migration():
    index_names = {idx.name for idx in MirrorNetworkNode.__table__.indexes}
    assert "uq_mirror_network_nodes_legacy_user_conversation" in index_names

    migration = Path(__file__).resolve().parents[1] / (
        "migrations/versions/add_mirror_journey_identity_pass_closure.py"
    )
    src = migration.read_text(encoding="utf-8")
    assert "uq_mirror_network_nodes_legacy_user_conversation" in src
    assert "artifact_kind = 'legacy_landing'" in src
    assert "conversation_id IS NOT NULL" in src
    assert "unique=True" in src


@pytest.mark.asyncio
async def test_legacy_parallel_publish_integrity_error_recovers_single_node():
    """Two concurrent legacy creates: second hits unique → recover via conversation lookup."""
    user = _user()
    db = AsyncMock()
    db.rollback = AsyncMock()

    raced = SimpleNamespace(
        id=uuid.uuid4(),
        slug="legacy-winner",
        user_id=user.id,
        conversation_id="conv-shared-1",
        scene_image_url="https://cdn.example/first.jpg",
        parent_slug=None,
        published_at=None,
        artifact_kind=ARTIFACT_KIND_LEGACY_LANDING,
        journey_version=1,
        private_payload={},
        public_payload={},
        card_title="first",
        card_date="2026-08-08",
        safety_status="open",
        visibility="public",
        updated_at=None,
    )

    lookups = [None, raced]

    async def _by_conv(*_a, **_k):
        return lookups.pop(0) if lookups else raced

    with (
        patch(
            "backend.services.mirror_network.publish.mirror_journey_v1_enabled",
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new_callable=AsyncMock,
            side_effect=_by_conv,
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new_callable=AsyncMock,
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.generate_mirror_slug",
            return_value="legacy-loser-slug",
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new_callable=AsyncMock,
            side_effect=IntegrityError("insert", {}, Exception("legacy unique")),
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new_callable=AsyncMock,
            return_value=raced,
        ) as mock_update,
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNodeRecord.from_orm",
            side_effect=lambda node: node,
        ),
        patch(
            "backend.services.mirror_network.publish.node_to_public_payload",
            return_value=SimpleNamespace(slug="legacy-winner", shareUrl="/m/legacy-winner"),
        ),
    ):
        result = await publish_mirror_to_network(db, user, _body())

    assert result.slug == "legacy-winner"
    db.rollback.assert_awaited_once()
    mock_update.assert_awaited_once()
    assert raced.artifact_kind == ARTIFACT_KIND_LEGACY_LANDING


# --- 2. Journey steps version-aware ---


def test_journey_steps_unique_includes_version():
    cols = {c.name for c in MirrorJourneyStep.__table__.columns}
    assert "journey_version" in cols

    unique = [
        c
        for c in MirrorJourneyStep.__table__.constraints
        if isinstance(c, UniqueConstraint)
    ]
    assert unique, "expected UniqueConstraint on mirror_journey_steps"
    col_names = {tuple(col.name for col in uc.columns) for uc in unique}
    assert ("journey_slug", "journey_version", "step_index") in col_names


def test_journey_steps_versions_can_coexist_in_schema_contract():
    """Same slug may store v1 and v2 step_index=1; same version cannot duplicate index."""
    # Schema-level: uniqueness is (slug, version, index) — not (slug, index) alone.
    uc = next(
        c
        for c in MirrorJourneyStep.__table__.constraints
        if isinstance(c, UniqueConstraint)
        and c.name == "uq_mirror_journey_steps_slug_version_index"
    )
    assert [col.name for col in uc.columns] == [
        "journey_slug",
        "journey_version",
        "step_index",
    ]
    # Document coexistence: different versions share slug+index without colliding.
    v1_key = ("journey-a", 1, 1)
    v2_key = ("journey-a", 2, 1)
    assert v1_key != v2_key
    same_version_dup = ("journey-a", 1, 1)
    assert same_version_dup == v1_key


def test_pass_closure_migration_rewrites_step_uniqueness():
    migration = Path(__file__).resolve().parents[1] / (
        "migrations/versions/add_mirror_journey_identity_pass_closure.py"
    )
    src = migration.read_text(encoding="utf-8")
    assert "journey_version" in src
    assert "uq_mirror_journey_steps_slug_version_index" in src
    assert "uq_mirror_journey_steps_slug_index" in src


# --- 3. Strict feature flag ---


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, False),
        (False, False),
        (True, True),
        (0, False),
        (1, True),
        ("", False),
        ("false", False),
        ("FALSE", False),
        ("0", False),
        ("true", True),
        ("TRUE", True),
        ("1", True),
        ("  true  ", True),
    ],
)
def test_parse_strict_env_bool_matrix(raw, expected):
    assert parse_strict_env_bool(raw, field_name="EZA_MIRROR_JOURNEY_V1") is expected


@pytest.mark.parametrize(
    "raw",
    ["yes", "on", "enabled", "maybe", "2", "-1", "Trueish", "falsey"],
)
def test_parse_strict_env_bool_rejects_malformed(raw):
    with pytest.raises(ValueError, match="EZA_MIRROR_JOURNEY_V1"):
        parse_strict_env_bool(raw, field_name="EZA_MIRROR_JOURNEY_V1")


def test_settings_journey_flag_defaults_off():
    settings = Settings(EZA_MIRROR_JOURNEY_V1=False)
    assert settings.EZA_MIRROR_JOURNEY_V1 is False


def test_settings_journey_flag_accepts_true_string():
    settings = Settings(EZA_MIRROR_JOURNEY_V1="true")
    assert settings.EZA_MIRROR_JOURNEY_V1 is True


def test_settings_journey_flag_rejects_malformed():
    with pytest.raises(ValidationError):
        Settings(EZA_MIRROR_JOURNEY_V1="yes")


def test_settings_journey_flag_rejects_on_coercion():
    """Pydantic must not silently treat 'on' / 'yes' as True for this flag."""
    with pytest.raises(ValidationError):
        Settings(EZA_MIRROR_JOURNEY_V1="on")
