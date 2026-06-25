# -*- coding: utf-8 -*-
"""Mirror Network Stage 1 — public/private contract, safety, slug, API."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.mirror_network.fixtures import (
    JAPAN_FIXTURE_BUNDLE,
    JAPAN_FIXTURE_INTELLIGENCE_PRIVATE,
    build_fixture_mirror_node,
)
from backend.services.mirror_network.public_payload import (
    audit_public_payload,
    split_curiosity_payloads,
)
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety
from backend.services.mirror_network.service import build_debug_report, node_to_public_payload
from backend.services.mirror_network.slug import build_mirror_share_url, generate_mirror_slug

client = TestClient(app)

FORBIDDEN_PUBLIC_KEYS = {
    "userId",
    "conversationId",
    "mirrorBody",
    "topicSummary",
    "evidenceLabels",
    "intelligenceBrief",
    "behavioralSnapshot",
    "curiosityPipeline",
    "private_payload",
}


def test_generate_mirror_slug_is_url_safe():
    slug = generate_mirror_slug("Sokak Lambaları", suffix="abc123")
    assert slug == "sokak-lambalari-abc123"
    assert "/" not in slug


def test_build_share_url():
    url = build_mirror_share_url("kyoto-lamps-a1b2c3")
    assert url.endswith("/m/kyoto-lamps-a1b2c3")


def test_split_curiosity_payloads_separates_public_and_private():
    node = build_fixture_mirror_node(slug_suffix="split1")
    public, private = split_curiosity_payloads(
        slug=node.slug,
        card_title=node.card_title,
        card_date=node.card_date,
        scene_image_url=node.scene_image_url,
        user_id=str(node.user_id),
        conversation_id=node.conversation_id,
        curiosity_bundle=JAPAN_FIXTURE_BUNDLE,
        intelligence_private=JAPAN_FIXTURE_INTELLIGENCE_PRIVATE,
    )

    assert public.cardTitle == "Sokak Lambaları"
    assert public.coreCuriosity
    assert private.userId
    assert private.mirrorBody
    assert private.conversationId

    public_json = json.dumps(public.model_dump())
    for key in FORBIDDEN_PUBLIC_KEYS:
        assert key not in public_json


def test_public_payload_audit_passes_fixture():
    node = build_fixture_mirror_node(slug_suffix="audit1")
    public = node_to_public_payload(node)
    audit = audit_public_payload(public)
    assert audit.passed is True
    assert not audit.forbiddenKeysFound


def test_safety_gate_blocks_restricted_and_private():
    restricted = build_fixture_mirror_node(slug_suffix="rest1", safety_status="restricted")
    assert evaluate_mirror_network_safety(restricted).passed is False

    private_vis = build_fixture_mirror_node(slug_suffix="priv1", visibility="private")
    assert evaluate_mirror_network_safety(private_vis).passed is False

    open_node = build_fixture_mirror_node(slug_suffix="open1")
    assert evaluate_mirror_network_safety(open_node).passed is True


def test_debug_report_never_includes_private_body():
    node = build_fixture_mirror_node(slug_suffix="dbg1")
    report = build_debug_report(node)
    report_json = json.dumps(report.model_dump())
    assert "mirrorBody" not in report_json
    assert "Bugün Kyoto" not in report_json
    assert report.privatePayloadPresent is True
    assert report.publicAudit.passed is True


def test_get_public_mirror_returns_fixture_payload():
    node = build_fixture_mirror_node(slug_suffix="api01")

    async def _fake_db():
        yield AsyncMock()

    with patch(
        "backend.routers.mirror_network.fetch_public_mirror_by_slug",
        new=AsyncMock(return_value=node_to_public_payload(node)),
    ):
        response = client.get(f"/api/mirror-network/{node.slug}")

    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == node.slug
    assert body["cardTitle"] == "Sokak Lambaları"
    assert "shareUrl" in body
    assert "userId" not in body
    assert "mirrorBody" not in body
    assert "conversationId" not in body


def test_get_public_mirror_not_found():
    with patch(
        "backend.routers.mirror_network.fetch_public_mirror_by_slug",
        new=AsyncMock(side_effect=__import__("fastapi").HTTPException(status_code=404, detail="missing")),
    ):
        response = client.get("/api/mirror-network/does-not-exist")
    assert response.status_code == 404


def test_debug_endpoint_requires_secret():
    response = client.get("/api/debug/mirror-network/any-slug")
    assert response.status_code in (401, 404)


def test_debug_endpoint_with_secret_returns_audit():
    from backend.routers import mirror_network

    node = build_fixture_mirror_node(slug_suffix="dbgapi")
    app.dependency_overrides[mirror_network._verify_debug_access] = lambda: None
    try:
        with patch(
            "backend.routers.mirror_network.fetch_debug_mirror_by_slug",
            new=AsyncMock(return_value=build_debug_report(node)),
        ):
            response = client.get(f"/api/debug/mirror-network/{node.slug}")
    finally:
        app.dependency_overrides.pop(mirror_network._verify_debug_access, None)

    assert response.status_code == 200
    body = response.json()
    assert body["publicAudit"]["passed"] is True
    assert "private_payload" not in json.dumps(body).lower() or body["privatePayloadPresent"] is True
