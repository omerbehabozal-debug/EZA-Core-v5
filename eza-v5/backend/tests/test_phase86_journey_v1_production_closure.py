# -*- coding: utf-8 -*-
"""Phase 8.6 — Journey V1 production closure (backend)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from backend.config import parse_strict_env_bool
from backend.routers.mirror_network import (
    MirrorNetworkCapabilitiesResponse,
    get_mirror_network_capabilities,
)
from backend.services.mirror_network.journey_publish_contract import (
    resolve_journey_publish_mode,
)


def test_journey_v1_flag_parser_aligns_with_frontend_true_1_contract():
    assert parse_strict_env_bool(None, field_name="EZA_MIRROR_JOURNEY_V1") is False
    assert parse_strict_env_bool("false", field_name="EZA_MIRROR_JOURNEY_V1") is False
    assert parse_strict_env_bool("0", field_name="EZA_MIRROR_JOURNEY_V1") is False
    assert parse_strict_env_bool("true", field_name="EZA_MIRROR_JOURNEY_V1") is True
    assert parse_strict_env_bool("1", field_name="EZA_MIRROR_JOURNEY_V1") is True


def test_capabilities_endpoint_returns_flag():
    with patch(
        "backend.services.mirror_network.journey_identity.mirror_journey_v1_enabled",
        return_value=True,
    ):
        result = asyncio.run(get_mirror_network_capabilities(_=None))
    assert isinstance(result, MirrorNetworkCapabilitiesResponse)
    assert result.journeyV1Enabled is True
    assert result.artifactKind == "journey_v1"
    assert result.clientFlag == "NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1"
    assert result.serverFlag == "EZA_MIRROR_JOURNEY_V1"


def test_publish_mode_fail_closed_when_flag_on_without_journey_id():
    with pytest.raises(HTTPException) as exc:
        resolve_journey_publish_mode(
            conversation_id="chat-1",
            journey_id_raw=None,
            selected_steps=None,
            flag_enabled=True,
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "journey_id_required"


def test_publish_py_keeps_identical_retry_and_atomic_freeze():
    publish = Path("services/mirror_network/publish.py").read_text(encoding="utf-8")
    lineage = Path("services/mirror/journey_generation_lineage.py").read_text(
        encoding="utf-8"
    )
    assert "identicalRetry" in lineage
    assert "Same-version identical retry" in publish or "stale_publish" in publish
    assert "stale_publish" in publish
    assert "journey_freeze_persist_failed" in publish or "await db.commit()" in publish


def test_creator_publish_does_not_emit_phase6_experience_events():
    text = Path("services/mirror_network/publish.py").read_text(encoding="utf-8")
    assert "ingest_yansi_experience_event" not in text
    assert "ingest_yansi_exposure_event" not in text


def test_unpublish_rehydrate_remains_published_only():
    router = Path("routers/mirror_network.py").read_text(encoding="utf-8")
    assert "published-journeys" in router
    assert "Generating/ready unpublished artifacts remain client-local" in router
    assert "/capabilities" in router
