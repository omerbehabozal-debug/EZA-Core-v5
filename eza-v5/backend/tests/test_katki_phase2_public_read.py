# -*- coding: utf-8 -*-
"""Katkılar Phase 2 — version-scoped public reads and visible counts."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(PGUUID, "sqlite")
def _compile_pg_uuid_for_sqlite(_type, _compiler, **_kw):
    return "CHAR(32)"


from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    KATKI_CONTRIBUTION_TYPES,
    YansiContribution,
)
from backend.services.mirror_network.katki_read import (
    PUBLIC_KATKI_CONTRIBUTION_KEYS,
    PUBLIC_KATKI_COUNT_KEYS,
    PUBLIC_KATKI_RESPONSE_KEYS,
    KatkiReadError,
    get_public_katki_read,
)
from backend.services.mirror_network.katki_target import KatkiResolvedTarget

SLUG = "beynin-gece"
T0 = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
FORBIDDEN_KEYS = {
    "contributor_user_id",
    "user_id",
    "email",
    "plan",
    "mirror_plan",
    "role",
    "entitlement",
    "reporter_user_id",
    "hidden_by_user_id",
    "id",
    "scope",
    "stepIndex",
    "step_index",
    "mirrorJourneyStepId",
    "sourceConversationId",
    "source_conversation_id",
    "source_user_message_id",
    "source_assistant_message_id",
    "sceneAssetId",
    "generationId",
    "owner_user_id",
    "node_id",
}


def _steps(n: int = 6) -> list[dict]:
    return [
        {"stepIndex": i, "publicQuestion": f"Q{i}?", "publicAnswer": f"A{i}"}
        for i in range(1, n + 1)
    ]


def _seal(version: int, owner) -> dict:
    return {
        "freezeStatus": "frozen",
        "journeyVersion": version,
        "selectedCount": 6,
        "authorUserId": str(owner),
        "publicLanding": {"publicTitle": f"Title v{version}", "publicSummary": "Summary"},
        "sceneImageUrl": "https://cdn.example/yansi.jpg",
    }


def _node(*, owner, node_id, version: int = 2, versions: dict | None = None, **overrides):
    seals = versions if versions is not None else {"1": _seal(1, owner), "2": _seal(2, owner)}
    current = seals.get(str(version), _seal(version, owner))
    base = {
        "id": node_id,
        "slug": SLUG,
        "user_id": owner,
        "artifact_kind": ARTIFACT_KIND_JOURNEY_V1,
        "journey_version": version,
        "freeze_status": "frozen",
        "visibility": "public",
        "safety_status": "open",
        "published_at": datetime(2026, 10, 1, tzinfo=timezone.utc),
        "frozen_at": datetime(2026, 10, 1, tzinfo=timezone.utc),
        "parent_slug": None,
        "window_index": None,
        "window_start": None,
        "window_end": None,
        "private_payload": {
            "intelligenceBrief": {
                "frozenJourneyArtifact": current,
                "frozenJourneyVersions": seals,
                "freezeStatus": "frozen",
            }
        },
    }
    base.update(overrides)
    return type("Node", (), base)()


@pytest.fixture
def katki_world(monkeypatch):
    owner = uuid4()
    node_id = uuid4()
    node = _node(owner=owner, node_id=node_id)
    steps = {(SLUG, 1): _steps(), (SLUG, 2): _steps()}

    async def fake_get(_db, slug):
        key = (slug or "").strip().lower()
        return node if key == node.slug else None

    async def fake_steps(_db, *, journey_slug, journey_version):
        return list(steps.get((journey_slug, int(journey_version)), []))

    monkeypatch.setattr(
        "backend.services.mirror_network.katki_target.get_mirror_network_node_by_slug",
        fake_get,
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.repository.get_mirror_network_node_by_slug",
        fake_get,
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.list_frozen_steps_for_version",
        fake_steps,
    )
    return {"node": node, "owner": owner, "node_id": node_id, "steps": steps}


@pytest.fixture
async def katki_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiContribution.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


def _row(
    *,
    owner,
    version: int,
    contribution_type: str,
    visibility: str = "visible",
    body: str | None = "body",
    source_note: str | None = "note",
    created_at: datetime | None = None,
    public_id: UUID | None = None,
    internal_id: UUID | None = None,
    slug: str = SLUG,
    contributor=None,
):
    return {
        "id": internal_id or uuid4(),
        "public_id": public_id or uuid4(),
        "slug": slug,
        "journey_version": version,
        "contribution_type": contribution_type,
        "body": body,
        "source_note": source_note,
        "contributor_user_id": owner if contributor is None else contributor,
        "visibility": visibility,
        "created_at": created_at or T0,
        "hidden_by_user_id": owner if visibility.startswith("hidden") else None,
    }


async def _insert(db: AsyncSession, rows: list[dict]) -> None:
    await db.execute(insert(YansiContribution.__table__), rows)
    await db.commit()


def _keys(value) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        found.update(value)
        for item in value.values():
            found.update(_keys(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_keys(item))
    return found


async def _read(db, katki_world, version: int, slug: str = SLUG):
    return await get_public_katki_read(db, slug=slug, journey_version=version)


@pytest.mark.asyncio
async def test_versions_are_isolated_and_historical_is_not_current(katki_db, katki_world):
    owner = katki_world["owner"]
    await _insert(
        katki_db,
        [
            _row(owner=owner, version=1, contribution_type="verify", body="v1-verify", created_at=T0),
            _row(
                owner=owner,
                version=1,
                contribution_type="correction",
                body="v1-correction",
                created_at=T0 + timedelta(minutes=1),
            ),
            _row(owner=owner, version=2, contribution_type="verify", body="v2-only", created_at=T0),
        ],
    )
    assert katki_world["node"].journey_version == 2

    v1 = await _read(katki_db, katki_world, 1)
    v2 = await _read(katki_db, katki_world, 2)

    assert v1["journeyVersion"] == 1
    assert v2["journeyVersion"] == 2
    assert {item["body"] for item in v1["contributions"]} == {"v1-verify", "v1-correction"}
    assert {item["body"] for item in v2["contributions"]} == {"v2-only"}
    assert v1["totalVisibleCount"] == 2
    assert v2["totalVisibleCount"] == 1
    assert v1["countsByType"]["verify"] == 1
    assert v1["countsByType"]["correction"] == 1
    assert v1["countsByType"]["additional_information"] == 0
    assert v1["countsByType"]["different_perspective"] == 0
    assert v2["countsByType"]["verify"] == 1
    assert v2["countsByType"]["correction"] == 0
    assert v1["totalVisibleCount"] == sum(v1["countsByType"].values())
    assert "v2-only" not in json.dumps(v1)
    assert "v1-verify" not in json.dumps(v2)


@pytest.mark.asyncio
async def test_unknown_and_missing_version_fail_closed(katki_db, katki_world):
    owner = katki_world["owner"]
    await _insert(
        katki_db,
        [_row(owner=owner, version=9, contribution_type="verify", body="future-secret")],
    )
    for version in (9, None, 0):
        with pytest.raises(KatkiReadError) as raised:
            await get_public_katki_read(katki_db, slug=SLUG, journey_version=version)
        assert raised.value.reason == "frozen_journey_not_found"
        assert raised.value.status_code == 404


@pytest.mark.asyncio
async def test_only_visible_rows_are_counted_and_returned(katki_db, katki_world):
    owner = katki_world["owner"]
    hidden_note = "hidden-source-note-secret"
    withdrawn_body = "withdrawn-body-secret"
    await _insert(
        katki_db,
        [
            _row(
                owner=owner,
                version=1,
                contribution_type="verify",
                visibility="visible",
                body="shown",
                source_note="shown-note",
                created_at=T0,
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="correction",
                visibility="hidden_by_owner",
                body="owner-hidden",
                source_note=hidden_note,
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="additional_information",
                visibility="hidden_by_trust",
                body="trust-hidden",
                source_note="trust-note-secret",
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="different_perspective",
                visibility="withdrawn",
                body=withdrawn_body,
                source_note="withdrawn-note-secret",
            ),
        ],
    )
    payload = await _read(katki_db, katki_world, 1)
    dumped = json.dumps(payload)
    assert payload["totalVisibleCount"] == 1
    assert payload["countsByType"] == {
        "verify": 1,
        "correction": 0,
        "additional_information": 0,
        "different_perspective": 0,
    }
    assert [item["body"] for item in payload["contributions"]] == ["shown"]
    assert payload["totalVisibleCount"] == len(payload["contributions"])
    assert sum(payload["countsByType"].values()) == len(payload["contributions"])
    assert hidden_note not in dumped
    assert withdrawn_body not in dumped
    assert "owner-hidden" not in dumped
    assert "trust-hidden" not in dumped


@pytest.mark.asyncio
async def test_parent_access_failures_return_no_katki_data(katki_world):
    db = AsyncMock()
    cases = [
        {"visibility": "private"},
        {"safety_status": "restricted"},
        {"published_at": None},
    ]
    for overrides in cases:
        for key, value in overrides.items():
            setattr(katki_world["node"], key, value)
        with pytest.raises(KatkiReadError) as raised:
            await get_public_katki_read(db, slug=SLUG, journey_version=1)
        assert raised.value.status_code == 404
        db.execute.assert_not_called()
        katki_world["node"].visibility = "public"
        katki_world["node"].safety_status = "open"
        katki_world["node"].published_at = datetime(2026, 10, 1, tzinfo=timezone.utc)

    katki_world["steps"][(SLUG, 1)] = _steps(5)
    with pytest.raises(KatkiReadError):
        await get_public_katki_read(db, slug=SLUG, journey_version=1)
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_zero_is_a_real_empty_version(katki_db, katki_world):
    owner = katki_world["owner"]
    await _insert(
        katki_db,
        [_row(owner=owner, version=2, contribution_type="verify", body="other-version")],
    )
    payload = await _read(katki_db, katki_world, 1)
    assert payload["totalVisibleCount"] == 0
    assert payload["contributions"] == []
    assert payload["countsByType"] == {name: 0 for name in KATKI_CONTRIBUTION_TYPES}
    assert payload["journeyVersion"] == 1
    assert "other-version" not in json.dumps(payload)


@pytest.mark.asyncio
async def test_public_payload_has_no_identity_or_attachment_fields(katki_db, katki_world):
    owner = katki_world["owner"]
    internal_id = UUID("11111111-1111-1111-1111-111111111111")
    public_id = UUID("22222222-2222-2222-2222-222222222222")
    await _insert(
        katki_db,
        [
            _row(
                owner=owner,
                version=1,
                contribution_type="verify",
                body=None,
                source_note=None,
                internal_id=internal_id,
                public_id=public_id,
            )
        ],
    )
    payload = await _read(katki_db, katki_world, 1, slug="  BEYNIN-GECE  ")
    assert payload["slug"] == SLUG
    assert set(payload) == PUBLIC_KATKI_RESPONSE_KEYS
    assert set(payload["countsByType"]) == PUBLIC_KATKI_COUNT_KEYS
    assert set(payload["contributions"][0]) == PUBLIC_KATKI_CONTRIBUTION_KEYS
    assert payload["contributions"][0]["contributionId"] == str(public_id)
    assert payload["contributions"][0]["body"] is None
    assert payload["contributions"][0]["sourceNote"] is None
    dumped = json.dumps(payload)
    assert str(internal_id) not in dumped
    assert str(owner) not in dumped
    assert str(katki_world["node_id"]) not in dumped
    assert FORBIDDEN_KEYS.isdisjoint(_keys(payload))


@pytest.mark.asyncio
async def test_order_is_created_at_then_public_id(katki_db, katki_world):
    owner = katki_world["owner"]
    later = UUID("00000000-0000-0000-0000-000000000001")
    earlier_id = UUID("00000000-0000-0000-0000-000000000099")
    tie_low = UUID("00000000-0000-0000-0000-000000000010")
    tie_high = UUID("00000000-0000-0000-0000-000000000020")
    await _insert(
        katki_db,
        [
            _row(
                owner=owner,
                version=1,
                contribution_type="different_perspective",
                body="third",
                public_id=later,
                created_at=T0 + timedelta(hours=2),
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="verify",
                body="first",
                public_id=earlier_id,
                created_at=T0,
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="correction",
                body="tie-high",
                public_id=tie_high,
                created_at=T0 + timedelta(hours=1),
            ),
            _row(
                owner=owner,
                version=1,
                contribution_type="additional_information",
                body="tie-low",
                public_id=tie_low,
                created_at=T0 + timedelta(hours=1),
            ),
        ],
    )
    payload = await _read(katki_db, katki_world, 1)
    assert [item["body"] for item in payload["contributions"]] == [
        "first",
        "tie-low",
        "tie-high",
        "third",
    ]
    assert payload["totalVisibleCount"] == 4
    assert payload["countsByType"] == {
        "verify": 1,
        "correction": 1,
        "additional_information": 1,
        "different_perspective": 1,
    }


def test_route_requires_version_and_uses_frozen_404():
    from fastapi.testclient import TestClient

    from backend.core.utils.dependencies import get_db
    from backend.main import app

    async def _fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = _fake_db
    seen: dict = {}

    async def _capture(_db, *, slug, journey_version, viewer_user_id=None):
        seen["slug"] = slug
        seen["journey_version"] = journey_version
        seen["viewer_user_id"] = viewer_user_id
        return {
            "slug": SLUG,
            "journeyVersion": journey_version,
            "totalVisibleCount": 0,
            "countsByType": {name: 0 for name in KATKI_CONTRIBUTION_TYPES},
            "contributions": [],
        }

    try:
        with (
            patch(
                "backend.routers.mirror_network.rate_limit_standalone",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "backend.routers.mirror_network.get_public_katki_read",
                new=_capture,
            ),
        ):
            client = TestClient(app)
            missing = client.get(f"/api/mirror-network/{SLUG}/contributions")
            assert missing.status_code == 422
            assert seen == {}
            zero = client.get(
                f"/api/mirror-network/{SLUG}/contributions",
                params={"journeyVersion": 0},
            )
            assert zero.status_code == 422
            ok = client.get(
                f"/api/mirror-network/{SLUG}/contributions",
                params={"journeyVersion": 1},
            )
            assert ok.status_code == 200
            assert ok.json()["journeyVersion"] == 1
            assert ok.json()["totalVisibleCount"] == 0
            assert ok.json()["viewerHasActiveVerify"] is False
            assert seen == {"slug": SLUG, "journey_version": 1, "viewer_user_id": None}
            anonymous = client.get(
                f"/api/mirror-network/{SLUG}/contributions",
                params={"journeyVersion": 1},
                headers={"Authorization": "Bearer not-a-valid-token"},
            )
            assert anonymous.status_code == 200
            assert anonymous.json()["viewerHasActiveVerify"] is False
            assert seen["viewer_user_id"] is None

        with (
            patch(
                "backend.routers.mirror_network.rate_limit_standalone",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "backend.routers.mirror_network.get_public_katki_read",
                new=AsyncMock(
                    side_effect=KatkiReadError("frozen_journey_not_found", status_code=404)
                ),
            ),
        ):
            client = TestClient(app)
            blocked = client.get(
                f"/api/mirror-network/{SLUG}/contributions",
                params={"journeyVersion": 2},
            )
            assert blocked.status_code == 404
            assert blocked.json()["detail"]["code"] == "frozen_journey_not_found"
            assert "contributions" not in blocked.json()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_resolved_target_still_has_no_attachment_identity():
    target = KatkiResolvedTarget(
        slug=SLUG,
        journey_version=1,
        node_id=uuid4(),
        owner_user_id=uuid4(),
    )
    assert set(target.__dataclass_fields__) == {
        "slug",
        "journey_version",
        "node_id",
        "owner_user_id",
    }


@pytest.mark.asyncio
async def test_viewer_has_active_verify_is_exact_and_private(katki_db, katki_world):
    viewer = katki_world["owner"]
    other = uuid4()

    none = await get_public_katki_read(katki_db, slug=SLUG, journey_version=1)
    assert none["viewerHasActiveVerify"] is False
    anonymous = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=None
    )
    assert anonymous["viewerHasActiveVerify"] is False
    signed_out_of_rows = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=viewer
    )
    assert signed_out_of_rows["viewerHasActiveVerify"] is False

    await _insert(
        katki_db,
        [
            _row(owner=viewer, version=1, contribution_type="verify", body=None),
        ],
    )
    visible = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=viewer
    )
    assert visible["viewerHasActiveVerify"] is True
    assert visible["totalVisibleCount"] == 1
    assert _keys(visible).isdisjoint(FORBIDDEN_KEYS)
    assert "viewerId" not in _keys(visible)
    assert "userId" not in _keys(visible)
    assert "isMine" not in _keys(visible)

    await katki_db.execute(YansiContribution.__table__.delete())
    await katki_db.commit()

    cases = [
        ("hidden_by_owner", True, 0),
        ("hidden_by_trust", True, 0),
        ("withdrawn", False, 0),
    ]
    for visibility, expected, visible_count in cases:
        await katki_db.execute(YansiContribution.__table__.delete())
        await katki_db.commit()
        await _insert(
            katki_db,
            [
                _row(
                    owner=viewer,
                    version=1,
                    contribution_type="verify",
                    visibility=visibility,
                    body=None,
                )
            ],
        )
        payload = await get_public_katki_read(
            katki_db, slug=SLUG, journey_version=1, viewer_user_id=viewer
        )
        assert payload["viewerHasActiveVerify"] is expected
        assert payload["totalVisibleCount"] == visible_count

    await katki_db.execute(YansiContribution.__table__.delete())
    await katki_db.commit()
    await _insert(
        katki_db,
        [
            _row(
                owner=viewer,
                version=1,
                contribution_type="verify",
                contributor=other,
                body=None,
            ),
            _row(
                owner=viewer,
                version=2,
                contribution_type="verify",
                body=None,
            ),
            _row(
                owner=viewer,
                version=1,
                contribution_type="verify",
                slug="baska-yansi",
                body=None,
            ),
        ],
    )
    other_user = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=viewer
    )
    assert other_user["countsByType"]["verify"] == 1
    assert other_user["totalVisibleCount"] == 1
    assert other_user["viewerHasActiveVerify"] is False
    public_aggregate = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=None
    )
    assert public_aggregate["countsByType"]["verify"] == 1
    assert public_aggregate["viewerHasActiveVerify"] is False
    own_other_version = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=2, viewer_user_id=viewer
    )
    assert own_other_version["viewerHasActiveVerify"] is True
    missed_version = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=1, viewer_user_id=viewer
    )
    assert missed_version["viewerHasActiveVerify"] is False
    other_reader = await get_public_katki_read(
        katki_db, slug=SLUG, journey_version=2, viewer_user_id=other
    )
    assert other_reader["viewerHasActiveVerify"] is False
