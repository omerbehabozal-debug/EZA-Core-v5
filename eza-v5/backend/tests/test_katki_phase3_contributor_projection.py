# -*- coding: utf-8 -*-
"""Katkılar Phase 3 — live public contributor projection on visible reads."""

from __future__ import annotations

import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.core.schemas.mirror_network import (
    PublicFrozenJourneyArtifact,
    PublicFrozenJourneyStep,
    PublicFrozenStepEzaSnapshot,
    PublicKatkiContributor,
    PublicKatkiRead,
)
from backend.services.mirror_network.katki_read import (
    PUBLIC_KATKI_CONTRIBUTOR_KEYS,
    PUBLIC_KATKI_CONTRIBUTION_KEYS,
    project_public_katki_contributor,
    get_public_katki_read,
)
from backend.services.mirror_network.public_identity import PUBLIC_DISPLAY_NAME_FALLBACK
from tests.test_katki_phase2_public_read import (  # noqa: F401
    SLUG,
    T0,
    _insert,
    _keys,
    _row,
    katki_db,
    katki_world,
)

AVATAR_A = "/api/public/profile-avatars/11111111-1111-4111-8111-111111111111.png"
AVATAR_B = "/api/public/profile-avatars/22222222-2222-4222-8222-222222222222.png"
STORAGE_PATH = "data/profile_avatars/secret-internal.png"
FORBIDDEN_KEYS = {
    "contributor_user_id",
    "user_id",
    "userId",
    "id",
    "email",
    "phone",
    "plan",
    "mirror_plan",
    "role",
    "entitlement",
    "subscription",
    "account_tier",
    "is_active",
    "reporter_user_id",
    "hidden_by_user_id",
    "owner_user_id",
    "node_id",
    "public_honorific",
    "moderation",
    "scope",
    "stepIndex",
    "step_index",
    "step_id",
    "mirrorJourneyStepId",
    "sourceConversationId",
    "source_conversation_id",
    "source_user_message_id",
    "source_assistant_message_id",
    "sceneAssetId",
    "generationId",
}
FROZEN_ARTIFACT_FIELDS = {
    "slug",
    "journeyId",
    "journeyVersion",
    "publicTitle",
    "publicSummary",
    "continuationContext",
    "sceneImageUrl",
    "artifactId",
    "generationId",
    "sceneAssetId",
    "sourceConversationId",
    "authorUserId",
    "parentSlug",
    "selectedCount",
    "steps",
    "publishedAt",
    "replayReady",
}


def _person(user_id, *, name, avatar, revision=1, email="hidden@example.com"):
    return SimpleNamespace(
        id=user_id,
        email=email,
        role="user",
        mirror_plan="plus",
        public_display_name=name,
        public_honorific="bilgin",
        public_avatar_url=avatar,
        public_avatar_revision=revision,
    )


def _loader(people: dict):
    calls: list[list] = []

    async def _load(_db, user_ids):
        calls.append(list(user_ids))
        return {uid: people[uid] for uid in user_ids if uid in people}

    return calls, _load


@pytest.mark.asyncio
async def test_two_contributors_keep_their_own_public_identity(katki_db, katki_world):
    ayse = uuid4()
    tarik = uuid4()
    people = {
        ayse: _person(ayse, name="Ayşe Meraklı", avatar=AVATAR_A, revision=4),
        tarik: _person(tarik, name="Tarık Ayşe", avatar=AVATAR_B, revision=7),
    }
    await _insert(
        katki_db,
        [
            _row(owner=ayse, version=1, contribution_type="verify", body="from-ayse", created_at=T0),
            _row(
                owner=tarik,
                version=1,
                contribution_type="correction",
                body="from-tarik",
                created_at=T0 + timedelta(minutes=1),
            ),
        ],
    )
    calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        payload = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    assert len(calls) == 1
    assert set(calls[0]) == {ayse, tarik}
    by_body = {item["body"]: item["contributor"] for item in payload["contributions"]}
    assert by_body["from-ayse"] == {
        "displayName": "Ayşe Meraklı",
        "publicAvatarUrl": AVATAR_A,
        "publicAvatarRevision": 4,
        "publicHonorific": "Bilgin",
    }
    assert by_body["from-tarik"] == {
        "displayName": "Tarık Ayşe",
        "publicAvatarUrl": AVATAR_B,
        "publicAvatarRevision": 7,
        "publicHonorific": "Bilgin",
    }
    assert payload["totalVisibleCount"] == 2
    assert payload["countsByType"]["verify"] == 1
    assert payload["countsByType"]["correction"] == 1


@pytest.mark.asyncio
async def test_repeated_contributor_is_one_bulk_projection(katki_db, katki_world):
    ayse = uuid4()
    people = {ayse: _person(ayse, name="Ayşe Meraklı", avatar=AVATAR_A, revision=4)}
    await _insert(
        katki_db,
        [
            _row(owner=ayse, version=1, contribution_type="verify", body="first", created_at=T0),
            _row(
                owner=ayse,
                version=1,
                contribution_type="additional_information",
                body="second",
                created_at=T0 + timedelta(minutes=1),
            ),
        ],
    )
    calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        payload = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    assert len(calls) == 1
    assert calls[0] == [ayse, ayse]
    assert payload["contributions"][0]["contributor"] == payload["contributions"][1]["contributor"]
    assert payload["totalVisibleCount"] == 2
    assert sum(payload["countsByType"].values()) == 2


@pytest.mark.asyncio
async def test_hidden_and_withdrawn_identities_are_not_loaded(katki_db, katki_world):
    shown = uuid4()
    hidden = uuid4()
    withdrawn = uuid4()
    people = {
        shown: _person(shown, name="Görünen", avatar=AVATAR_A, revision=1),
        hidden: _person(hidden, name="Gizli Kişi", avatar=AVATAR_B, revision=9),
        withdrawn: _person(withdrawn, name="Çekilen Kişi", avatar=AVATAR_B, revision=8),
    }
    await _insert(
        katki_db,
        [
            _row(owner=shown, version=1, contribution_type="verify", body="shown", created_at=T0),
            _row(
                owner=hidden,
                version=1,
                contribution_type="correction",
                visibility="hidden_by_owner",
                body="hidden-body",
                source_note="hidden-note",
            ),
            _row(
                owner=withdrawn,
                version=1,
                contribution_type="different_perspective",
                visibility="withdrawn",
                body="withdrawn-body",
            ),
            _row(
                owner=hidden,
                version=1,
                contribution_type="additional_information",
                visibility="hidden_by_trust",
                body="trust-body",
            ),
        ],
    )
    calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        payload = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    assert len(calls) == 1
    assert calls[0] == [shown]
    dumped = json.dumps(payload)
    assert "Gizli Kişi" not in dumped
    assert "Çekilen Kişi" not in dumped
    assert "hidden-body" not in dumped
    assert "withdrawn-body" not in dumped
    assert payload["totalVisibleCount"] == 1
    assert payload["countsByType"]["verify"] == 1
    assert payload["countsByType"]["correction"] == 0
    assert payload["contributions"][0]["contributor"]["displayName"] == "Görünen"


@pytest.mark.asyncio
async def test_version_projection_uses_live_profile_not_the_other_version(katki_db, katki_world):
    ayse = uuid4()
    tarik = uuid4()
    people = {
        ayse: _person(ayse, name="Ayşe Bugün", avatar=AVATAR_A, revision=2),
        tarik: _person(tarik, name="Tarık Sadece V2", avatar=AVATAR_B, revision=3),
    }
    await _insert(
        katki_db,
        [
            _row(owner=ayse, version=1, contribution_type="verify", body="v1", created_at=T0),
            _row(owner=tarik, version=2, contribution_type="verify", body="v2", created_at=T0),
        ],
    )
    calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        historical = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    assert calls == [[ayse]]
    assert historical["journeyVersion"] == 1
    assert historical["contributions"][0]["contributor"]["displayName"] == "Ayşe Bugün"
    assert historical["contributions"][0]["contributor"]["publicAvatarUrl"] == AVATAR_A
    assert "Tarık Sadece V2" not in json.dumps(historical)
    assert "v2" not in {item["body"] for item in historical["contributions"]}


@pytest.mark.asyncio
async def test_missing_and_incomplete_profiles_follow_public_card_contract(katki_db, katki_world):
    missing_name = uuid4()
    absent = uuid4()
    storage = uuid4()
    people = {
        missing_name: SimpleNamespace(
            id=missing_name,
            email="secret-local@example.com",
            public_display_name=None,
            public_avatar_url=None,
            public_avatar_revision=None,
        ),
        storage: SimpleNamespace(
            id=storage,
            email="path@example.com",
            public_display_name="Depo",
            public_avatar_url=STORAGE_PATH,
            public_avatar_revision=6,
        ),
    }
    await _insert(
        katki_db,
        [
            _row(owner=missing_name, version=1, contribution_type="verify", body="unnamed", created_at=T0),
            _row(
                owner=absent,
                version=1,
                contribution_type="correction",
                body="absent",
                created_at=T0 + timedelta(minutes=1),
            ),
            _row(
                owner=storage,
                version=1,
                contribution_type="additional_information",
                body="storage",
                created_at=T0 + timedelta(minutes=2),
            ),
        ],
    )
    _calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        payload = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    by_body = {item["body"]: item["contributor"] for item in payload["contributions"]}
    assert by_body["unnamed"] == {
        "displayName": PUBLIC_DISPLAY_NAME_FALLBACK,
        "publicAvatarUrl": None,
        "publicAvatarRevision": 0,
        "publicHonorific": "Meraklı",
    }
    assert by_body["absent"] == by_body["unnamed"]
    assert by_body["storage"]["displayName"] == "Depo"
    assert by_body["storage"]["publicAvatarUrl"] is None
    assert by_body["storage"]["publicAvatarRevision"] == 6
    dumped = json.dumps(payload)
    assert "secret-local" not in dumped
    assert STORAGE_PATH not in dumped
    assert "profile_avatars" not in dumped


@pytest.mark.asyncio
async def test_serialized_response_contributor_allowlist(katki_db, katki_world):
    ayse = uuid4()
    internal_id = uuid4()
    public_id = uuid4()
    people = {ayse: _person(ayse, name="Ayşe Meraklı", avatar=AVATAR_A, revision=4)}
    await _insert(
        katki_db,
        [
            _row(
                owner=ayse,
                version=1,
                contribution_type="verify",
                body=None,
                source_note=None,
                internal_id=internal_id,
                public_id=public_id,
            )
        ],
    )
    _calls, loader = _loader(people)
    with patch(
        "backend.services.mirror_network.katki_read._load_discover_authors",
        new=loader,
    ):
        payload = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)

    dumped = PublicKatkiRead.model_validate(payload).model_dump()
    item = dumped["contributions"][0]
    assert set(item) == PUBLIC_KATKI_CONTRIBUTION_KEYS
    assert set(item["contributor"]) == PUBLIC_KATKI_CONTRIBUTOR_KEYS
    assert FORBIDDEN_KEYS.isdisjoint(_keys(dumped))
    raw = json.dumps(dumped)
    assert str(ayse) not in raw
    assert str(internal_id) not in raw
    assert str(katki_world["node_id"]) not in raw
    assert str(katki_world["owner"]) not in raw
    assert "hidden@example.com" not in raw
    assert "plus" not in raw
    assert item["contributionId"] == str(public_id)


def test_direct_projection_matches_discover_card_helpers():
    incomplete = project_public_katki_contributor(None)
    assert incomplete == {
        "displayName": PUBLIC_DISPLAY_NAME_FALLBACK,
        "publicAvatarUrl": None,
        "publicAvatarRevision": 0,
        "publicHonorific": "Meraklı",
    }
    stored = project_public_katki_contributor(
        SimpleNamespace(
            public_display_name="  Ayşe   Meraklı  ",
            public_avatar_url=AVATAR_A,
            public_avatar_revision="4",
        )
    )
    assert stored["displayName"] == "Ayşe Meraklı"
    assert stored["publicAvatarUrl"] == AVATAR_A
    assert stored["publicAvatarRevision"] == 4
    blocked = project_public_katki_contributor(
        SimpleNamespace(
            public_display_name="Depo",
            public_avatar_url=STORAGE_PATH,
            public_avatar_revision=1,
        )
    )
    assert blocked["publicAvatarUrl"] is None


def test_contributor_schema_forbids_account_fields():
    with pytest.raises(ValidationError):
        PublicKatkiContributor.model_validate(
            {
                "displayName": "Ayşe",
                "publicAvatarUrl": None,
                "publicAvatarRevision": 0,
                "userId": str(uuid4()),
            }
        )


def test_frozen_public_shape_has_no_contributor():
    assert set(PublicFrozenJourneyArtifact.model_fields) == FROZEN_ARTIFACT_FIELDS
    assert "contributor" not in PublicFrozenJourneyStep.model_fields
    assert "contributor" not in PublicFrozenStepEzaSnapshot.model_fields
    with pytest.raises(ValidationError):
        PublicFrozenJourneyArtifact.model_validate(
            {
                "slug": "a",
                "journeyId": "a",
                "journeyVersion": 1,
                "authorUserId": "u",
                "selectedCount": 6,
                "steps": [
                    {"stepIndex": i, "publicQuestion": f"q{i}", "publicAnswer": f"a{i}"}
                    for i in range(1, 7)
                ],
                "replayReady": True,
                "contributor": {
                    "displayName": "Ayşe",
                    "publicAvatarUrl": None,
                    "publicAvatarRevision": 0,
                },
            }
        )


def test_route_still_requires_journey_version():
    from fastapi.testclient import TestClient

    from backend.core.utils.dependencies import get_db
    from backend.main import app

    async def _fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = _fake_db
    try:
        with patch(
            "backend.routers.mirror_network.rate_limit_standalone",
            new=AsyncMock(return_value=None),
        ):
            client = TestClient(app)
            missing = client.get(f"/api/mirror-network/{SLUG}/contributions")
            assert missing.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
