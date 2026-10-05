# -*- coding: utf-8 -*-
"""Katkılar Phase 5 — authenticated create on one exact frozen version."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.dml import Insert

from backend.services.mirror_network.katki_create import (
    KatkiCreateError,
    _is_active_type_conflict,
)


@compiles(PGUUID, "sqlite")
def _compile_pg_uuid_for_sqlite(_type, _compiler, **_kw):
    return "CHAR(32)"


from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorNetworkNode,
    YansiContribution,
    YansiContributionReport,
)
from backend.models.production import User
from backend.services.mirror_network.katki_create import create_katki, toggle_viewer_verify
from backend.services.mirror_network.katki_moderation import (
    owner_hide_katki,
    owner_restore_katki,
    report_katki,
    trust_hide_katki,
    trust_restore_katki,
    withdraw_katki,
)
from backend.services.mirror_network.katki_read import get_public_katki_read

SLUG = "beynin-gece"
OTHER_SLUG = "diger-yansi"
T0 = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
BODY_20 = "a" * 20
TYPES = (
    "verify",
    "correction",
    "additional_information",
    "different_perspective",
)
OTHER_TYPES = TYPES[1:]
PUBLIC_KEYS = {
    "contributionId",
    "type",
    "body",
    "sourceNote",
    "createdAt",
    "contributor",
}
CONTRIBUTOR_KEYS = {
    "displayName",
    "publicAvatarUrl",
    "publicAvatarRevision",
    "publicHonorific",
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
        "publicLanding": {"publicTitle": "Title", "publicSummary": "Summary"},
        "sceneImageUrl": "https://cdn.example/yansi.jpg",
    }


@pytest.fixture
def parents(monkeypatch):
    nodes: dict = {}
    steps: dict = {}

    def add(slug: str, owner, versions=range(1, 9)):
        node = SimpleNamespace(
            id=uuid4(),
            slug=slug,
            user_id=owner,
            artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
            journey_version=max(versions),
            freeze_status="frozen",
            visibility="public",
            safety_status="open",
            published_at=T0,
            frozen_at=T0,
            parent_slug=None,
            window_index=None,
            window_start=None,
            window_end=None,
        )
        seals = {str(version): _seal(version, owner) for version in versions}
        node.private_payload = {
            "intelligenceBrief": {
                "frozenJourneyArtifact": seals[str(node.journey_version)],
                "frozenJourneyVersions": seals,
                "freezeStatus": "frozen",
            }
        }
        nodes[slug] = node
        for version in versions:
            steps[(slug, version)] = _steps()
        return node

    async def fake_get(_db, slug):
        key = (slug or "").strip().lower()
        return nodes.get(key)

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
    return SimpleNamespace(add=add, nodes=nodes, steps=steps)


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(User.__table__.create)
        await conn.run_sync(MirrorNetworkNode.__table__.create)
        await conn.run_sync(YansiContribution.__table__.create)
        await conn.run_sync(YansiContributionReport.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


def _user(email: str, name: str) -> dict:
    return {
        "id": uuid4(),
        "email": email,
        "role": "user",
        "is_active": True,
        "mirror_plan": "free",
        "public_display_name": name,
    }


def _node(owner_id, slug: str) -> dict:
    return {
        "id": uuid4(),
        "slug": slug,
        "user_id": owner_id,
        "visibility": "public",
        "safety_status": "open",
        "card_title": "Beynin",
        "card_date": "2026-10-01",
        "public_payload": {"publicTitle": "Beynin"},
        "private_payload": {},
        "artifact_kind": ARTIFACT_KIND_JOURNEY_V1,
        "journey_version": 8,
        "published_at": T0,
    }


def _same(left, right) -> bool:
    return UUID(str(left)).hex == UUID(str(right)).hex


def _slot(index: int) -> tuple[str, int]:
    return TYPES[index % 4], (index // 4) + 1


async def _count(db) -> int:
    table = YansiContribution.__table__
    result = await db.execute(select(func.count()).select_from(table))
    return int(result.scalar_one())


async def _stored(db, public_id):
    table = YansiContribution.__table__
    result = await db.execute(
        select(table).where(table.c.public_id == UUID(str(public_id)))
    )
    return result.mappings().one()


async def _ready(db, parents, *slugs: str):
    owner = _user("owner@example.com", "Owner")
    contributor = _user("contributor@example.com", "Ada")
    other = _user("other@example.com", "Bora")
    await db.execute(insert(User.__table__), [owner, contributor, other])
    chosen = slugs or (SLUG,)
    for slug in chosen:
        parents.add(slug, owner["id"])
        await db.execute(insert(MirrorNetworkNode.__table__), [_node(owner["id"], slug)])
    await db.commit()
    return owner, contributor, other


async def _create(
    db,
    actor,
    *,
    slug=SLUG,
    version=1,
    contribution_type="verify",
    body=None,
    source_note=None,
    raw_fields=None,
    now=None,
):
    fields = raw_fields
    if fields is None:
        fields = {
            "journeyVersion": version,
            "type": contribution_type,
            "body": body,
            "sourceNote": source_note,
        }
    return await create_katki(
        db,
        slug=slug,
        actor_user_id=actor["id"],
        journey_version=version,
        contribution_type=contribution_type,
        body=body,
        source_note=source_note,
        raw_fields=fields,
        now=now,
    )


def _assert_public(payload: dict) -> None:
    assert set(payload) == PUBLIC_KEYS
    assert set(payload["contributor"]) == CONTRIBUTOR_KEYS
    assert payload["contributor"]["displayName"] == "Ada"
    assert payload["contributor"]["publicAvatarUrl"] is None
    assert payload["contributor"]["publicAvatarRevision"] == 0
    assert "userId" not in payload["contributor"]


async def test_verify_omitted_and_null_body_succeed(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    omitted = await _create(db, contributor, body=None, source_note=None, now=T0)
    _assert_public(omitted)
    assert omitted["body"] is None
    assert omitted["sourceNote"] is None
    assert omitted["type"] == "verify"
    row = await _stored(db, omitted["contributionId"])
    assert row["body"] is None
    assert row["source_note"] is None
    assert row["visibility"] == "visible"
    assert row["withdrawn_at"] is None
    assert row["hidden_at"] is None
    assert row["hidden_by_user_id"] is None
    assert _same(row["contributor_user_id"], contributor["id"])
    assert row["journey_version"] == 1
    await withdraw_katki(db, public_id=UUID(omitted["contributionId"]), actor_user_id=contributor["id"])
    explicit = await _create(db, contributor, body=None, now=T0)
    assert explicit["body"] is None


async def test_verify_body_bounds_and_trim(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    created = await _create(db, contributor, body=f"  {BODY_20}  ", now=T0)
    assert created["body"] == BODY_20
    stored = await _stored(db, created["contributionId"])
    assert stored["body"] == BODY_20
    await withdraw_katki(db, public_id=UUID(created["contributionId"]), actor_user_id=contributor["id"])

    with pytest.raises(KatkiCreateError) as short:
        await _create(db, contributor, body="short", now=T0)
    assert short.value.code == "invalid_body"
    assert short.value.status_code == 422
    assert await _count(db) == 1

    with pytest.raises(KatkiCreateError) as huge:
        await _create(db, contributor, body="b" * 2001, now=T0)
    assert huge.value.code == "invalid_body"
    assert await _count(db) == 1

    whitespace = await _create(db, contributor, body="   ", now=T0)
    assert whitespace["body"] is None


@pytest.mark.parametrize("contribution_type", OTHER_TYPES)
@pytest.mark.parametrize(
    ("body", "ok"),
    [
        (None, False),
        ("", False),
        ("   ", False),
        ("a" * 19, False),
        ("a" * 20, True),
        ("a" * 2000, True),
        ("a" * 2001, False),
    ],
)
async def test_required_body_matrix(db, parents, contribution_type, body, ok):
    _owner, contributor, _other = await _ready(db, parents)
    if not ok:
        with pytest.raises(KatkiCreateError) as caught:
            await _create(
                db,
                contributor,
                contribution_type=contribution_type,
                body=body,
                now=T0,
            )
        assert caught.value.code == "invalid_body"
        assert await _count(db) == 0
        return
    supplied = body if body is not None else ""
    created = await _create(
        db,
        contributor,
        contribution_type=contribution_type,
        body=f"  {supplied}  ",
        now=T0,
    )
    assert created["type"] == contribution_type
    assert created["body"] == supplied
    stored = await _stored(db, created["contributionId"])
    assert stored["body"] == supplied


@pytest.mark.parametrize(
    ("note", "expected"),
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("  kaynak notu  ", "kaynak notu"),
        ("k" * 500, "k" * 500),
        ("https://example.com/kaynak", "https://example.com/kaynak"),
    ],
)
async def test_source_note_normalization(db, parents, note, expected):
    _owner, contributor, _other = await _ready(db, parents)
    created = await _create(db, contributor, body=None, source_note=note, now=T0)
    assert created["sourceNote"] == expected
    stored = await _stored(db, created["contributionId"])
    assert stored["source_note"] == expected


async def test_source_note_over_500_fails_without_a_row(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    with pytest.raises(KatkiCreateError) as caught:
        await _create(db, contributor, source_note="n" * 501, now=T0)
    assert caught.value.code == "invalid_source_note"
    assert await _count(db) == 0


async def test_unknown_type_is_rejected(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    for name in ("comment", "like", "Verify", "other", "reply"):
        with pytest.raises(KatkiCreateError) as caught:
            await _create(
                db,
                contributor,
                contribution_type=name,
                body=BODY_20,
                now=T0,
            )
        assert caught.value.code == "invalid_type"
    assert await _count(db) == 0


async def test_historical_version_and_canonical_slug(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    created = await _create(db, contributor, slug="  Beynin-Gece  ", version=1, now=T0)
    stored = await _stored(db, created["contributionId"])
    assert stored["slug"] == SLUG
    assert stored["journey_version"] == 1
    assert parents.nodes[SLUG].journey_version == 8


async def test_inaccessible_parents_insert_nothing(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    node = parents.nodes[SLUG]

    async def _denied(**kwargs):
        with pytest.raises(KatkiCreateError) as caught:
            await _create(db, contributor, now=T0, **kwargs)
        assert caught.value.code == "frozen_journey_not_found"
        assert caught.value.status_code == 404
        assert await _count(db) == 0

    await _denied(version=99)
    node.visibility = "private"
    await _denied(version=1)
    node.visibility = "public"
    node.safety_status = "restricted"
    await _denied(version=1)
    node.safety_status = "open"
    parents.steps[(SLUG, 1)] = _steps(2)
    await _denied(version=1)
    parents.steps[(SLUG, 1)] = _steps()
    await _denied(version=99)
    rows = await db.execute(select(YansiContribution.__table__.c.journey_version))
    assert rows.all() == []


@pytest.mark.parametrize(
    "field",
    [
        "scope",
        "stepIndex",
        "step_index",
        "mirrorJourneyStepId",
        "sourceConversationId",
        "source_conversation_id",
        "conversationId",
        "sceneAssetId",
        "scene_asset_id",
        "generationId",
        "generation_id",
        "userId",
        "contributorUserId",
        "contributor_user_id",
        "messageId",
        "source_user_message_id",
    ],
)
async def test_forbidden_attachment_fields_rejected(db, parents, field):
    _owner, contributor, _other = await _ready(db, parents)
    with pytest.raises(KatkiCreateError) as caught:
        await _create(
            db,
            contributor,
            raw_fields={
                "journeyVersion": 1,
                "type": "verify",
                "body": None,
                "sourceNote": None,
                field: "client-chosen",
            },
            now=T0,
        )
    assert caught.value.code == "forbidden_attachment"
    assert await _count(db) == 0


async def test_duplicate_active_type_rules(db, parents):
    owner, contributor, other = await _ready(db, parents)
    first = await _create(db, contributor, contribution_type="verify", now=T0)
    with pytest.raises(KatkiCreateError) as again:
        await _create(db, contributor, contribution_type="verify", now=T0)
    assert again.value.code == "active_contribution_exists"
    assert again.value.status_code == 409
    assert "uq_" not in str(again.value).lower()
    assert "integrity" not in str(again.value).lower()
    assert await _count(db) == 1

    second = await _create(
        db,
        contributor,
        contribution_type="correction",
        body=BODY_20,
        now=T0,
    )
    assert second["contributionId"] != first["contributionId"]
    other_user = await _create(db, other, contribution_type="verify", now=T0)
    assert other_user["contributionId"] != first["contributionId"]
    other_version = await _create(db, contributor, version=2, contribution_type="verify", now=T0)
    assert other_version["type"] == "verify"

    await withdraw_katki(
        db,
        public_id=UUID(first["contributionId"]),
        actor_user_id=contributor["id"],
    )
    recreated = await _create(db, contributor, contribution_type="verify", now=T0)
    assert recreated["contributionId"] != first["contributionId"]
    stored = await _stored(db, recreated["contributionId"])
    assert stored["visibility"] == "visible"
    old = await _stored(db, first["contributionId"])
    assert old["visibility"] == "withdrawn"
    assert owner["id"] != contributor["id"]


async def test_concurrent_duplicate_is_conflict_without_sql_leak(db, parents, monkeypatch):
    _owner, contributor, _other = await _ready(db, parents)
    await _create(db, contributor, now=T0)
    monkeypatch.setattr(
        "backend.services.mirror_network.katki_create._has_active_contribution",
        AsyncMock(return_value=False),
    )
    with pytest.raises(KatkiCreateError) as caught:
        await _create(db, contributor, now=T0)
    assert caught.value.code == "active_contribution_exists"
    assert caught.value.__cause__ is None
    assert "uq_yansi" not in str(caught.value)
    assert "UNIQUE" not in str(caught.value)
    assert await _count(db) == 1


def test_active_type_conflict_matches_only_the_known_index():
    class _Diag:
        constraint_name = "uq_yansi_contributions_active_type"

    class _Orig(Exception):
        diag = _Diag()

    named = IntegrityError("INSERT", {}, _Orig("unique violation"))
    assert _is_active_type_conflict(named) is True

    textual = IntegrityError(
        "INSERT",
        {},
        Exception("UNIQUE constraint failed: uq_yansi_contributions_active_type"),
    )
    assert _is_active_type_conflict(textual) is True

    unrelated = IntegrityError(
        "INSERT",
        {},
        Exception(
            "null value in column contributor_user_id; contribution_type check failed"
        ),
    )
    assert _is_active_type_conflict(unrelated) is False


async def test_unrelated_integrity_error_stays_a_sanitized_create_failure(db, parents, monkeypatch):
    _owner, contributor, _other = await _ready(db, parents)
    original = db.execute

    async def _raise_on_insert(statement, *args, **kwargs):
        if isinstance(statement, Insert):
            raise IntegrityError(
                "INSERT INTO yansi_contributions",
                {},
                Exception(
                    "null value in column contributor_user_id; contribution_type present; SQLSTATE 23502"
                ),
            )
        return await original(statement, *args, **kwargs)

    monkeypatch.setattr(db, "execute", _raise_on_insert)
    with pytest.raises(KatkiCreateError) as caught:
        await _create(db, contributor, now=T0)
    assert caught.value.code == "create_failed"
    assert caught.value.status_code == 500
    rendered = str(caught.value)
    assert "contributor_user_id" not in rendered
    assert "SQLSTATE" not in rendered
    assert "uq_yansi" not in rendered

    from backend.routers.mirror_network import _katki_create_http

    http = _katki_create_http(caught.value)
    assert http.detail["code"] == "create_failed"
    assert http.detail["message"] == "Katkı oluşturulamadı"
    assert "SQL" not in http.detail["message"]
    assert "constraint" not in http.detail["message"].lower()


async def test_hourly_window_uses_created_rows(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    for index in range(10):
        contribution_type, version = _slot(index)
        body = None if contribution_type == "verify" else BODY_20
        await _create(
            db,
            contributor,
            version=version,
            contribution_type=contribution_type,
            body=body,
            now=T0,
        )
    with pytest.raises(KatkiCreateError) as denied:
        contribution_type, version = _slot(10)
        await _create(
            db,
            contributor,
            version=version,
            contribution_type=contribution_type,
            body=BODY_20,
            now=T0,
        )
    assert denied.value.code == "katki_create_rate_limited"
    assert denied.value.status_code == 429
    assert await _count(db) == 10

    contribution_type, version = _slot(10)
    allowed = await _create(
        db,
        contributor,
        version=version,
        contribution_type=contribution_type,
        body=BODY_20,
        now=T0 + timedelta(hours=1),
    )
    assert allowed["contributionId"]
    assert await _count(db) == 11


async def test_daily_window_uses_created_rows(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    bursts = (
        T0,
        T0 + timedelta(hours=1, seconds=1),
        T0 + timedelta(hours=2, seconds=2),
    )
    for burst_index, moment in enumerate(bursts):
        for offset in range(10):
            contribution_type, version = _slot(burst_index * 10 + offset)
            body = None if contribution_type == "verify" else BODY_20
            await _create(
                db,
                contributor,
                version=version,
                contribution_type=contribution_type,
                body=body,
                now=moment,
            )
    with pytest.raises(KatkiCreateError) as denied:
        contribution_type, version = _slot(30)
        await _create(
            db,
            contributor,
            version=version,
            contribution_type=contribution_type,
            body=BODY_20,
            now=T0 + timedelta(hours=3, seconds=3),
        )
    assert denied.value.code == "katki_create_rate_limited"
    assert await _count(db) == 30

    contribution_type, version = _slot(30)
    allowed = await _create(
        db,
        contributor,
        version=version,
        contribution_type=contribution_type,
        body=BODY_20,
        now=T0 + timedelta(days=1, seconds=1),
    )
    assert allowed["type"] == contribution_type
    assert await _count(db) == 31


async def test_failures_do_not_consume_quota_and_limit_is_per_user(db, parents):
    _owner, contributor, other = await _ready(db, parents, SLUG, OTHER_SLUG)
    with pytest.raises(KatkiCreateError):
        await _create(db, contributor, body="short", now=T0)
    with pytest.raises(KatkiCreateError):
        await _create(db, contributor, version=99, now=T0)
    first = await _create(db, contributor, now=T0)
    with pytest.raises(KatkiCreateError) as duplicate:
        await _create(db, contributor, now=T0)
    assert duplicate.value.code == "active_contribution_exists"

    for index in range(1, 5):
        contribution_type, version = _slot(index)
        body = None if contribution_type == "verify" else BODY_20
        await _create(
            db,
            contributor,
            slug=SLUG,
            version=version,
            contribution_type=contribution_type,
            body=body,
            now=T0,
        )
    for index in range(5):
        contribution_type, version = _slot(index)
        body = None if contribution_type == "verify" else BODY_20
        await _create(
            db,
            contributor,
            slug=OTHER_SLUG,
            version=version,
            contribution_type=contribution_type,
            body=body,
            now=T0,
        )
    assert await _count(db) == 10
    with pytest.raises(KatkiCreateError) as limited:
        await _create(
            db,
            contributor,
            slug=OTHER_SLUG,
            version=3,
            contribution_type="different_perspective",
            body=BODY_20,
            now=T0,
        )
    assert limited.value.code == "katki_create_rate_limited"
    other_created = await _create(db, other, now=T0)
    assert other_created["contributionId"] != first["contributionId"]


async def test_withdrawal_does_not_refund_quota(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    created = []
    for index in range(10):
        contribution_type, version = _slot(index)
        body = None if contribution_type == "verify" else BODY_20
        created.append(
            await _create(
                db,
                contributor,
                version=version,
                contribution_type=contribution_type,
                body=body,
                now=T0,
            )
        )
    for item in created:
        await withdraw_katki(
            db,
            public_id=UUID(item["contributionId"]),
            actor_user_id=contributor["id"],
        )
    with pytest.raises(KatkiCreateError) as denied:
        await _create(db, contributor, now=T0)
    assert denied.value.code == "katki_create_rate_limited"
    assert await _count(db) == 10


async def test_create_public_read_and_moderation_round_trip(db, parents):
    owner, contributor, reporter = await _ready(db, parents)
    created = await _create(
        db,
        contributor,
        body=f"  {BODY_20}  ",
        source_note="  not  ",
        now=T0,
    )
    visible = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert visible["totalVisibleCount"] == 1
    assert visible["countsByType"]["verify"] == 1
    assert visible["countsByType"]["correction"] == 0
    assert visible["contributions"][0]["contributionId"] == created["contributionId"]
    assert visible["contributions"][0]["body"] == BODY_20
    assert visible["contributions"][0]["sourceNote"] == "not"
    assert visible["contributions"][0]["contributor"]["displayName"] == "Ada"
    assert set(visible["contributions"][0]["contributor"]) == CONTRIBUTOR_KEYS

    await report_katki(
        db,
        public_id=UUID(created["contributionId"]),
        reporter_user_id=reporter["id"],
        reason="other",
    )
    after_report = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert after_report["totalVisibleCount"] == 1

    await owner_hide_katki(
        db,
        public_id=UUID(created["contributionId"]),
        actor_user_id=owner["id"],
    )
    hidden = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert hidden["totalVisibleCount"] == 0
    assert hidden["contributions"] == []

    await owner_restore_katki(
        db,
        public_id=UUID(created["contributionId"]),
        actor_user_id=owner["id"],
    )
    restored = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert restored["contributions"][0]["contributionId"] == created["contributionId"]

    correction = await _create(
        db,
        contributor,
        contribution_type="correction",
        body=BODY_20,
        now=T0,
    )
    await trust_hide_katki(db, public_id=UUID(correction["contributionId"]))
    trust_hidden = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert trust_hidden["totalVisibleCount"] == 1
    assert trust_hidden["countsByType"]["correction"] == 0
    await trust_restore_katki(db, public_id=UUID(correction["contributionId"]))
    trust_back = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert trust_back["countsByType"]["correction"] == 1

    await withdraw_katki(
        db,
        public_id=UUID(created["contributionId"]),
        actor_user_id=contributor["id"],
    )
    withdrawn = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert created["contributionId"] not in {
        item["contributionId"] for item in withdrawn["contributions"]
    }
    recreated = await _create(db, contributor, now=T0 + timedelta(seconds=1))
    assert recreated["contributionId"] != created["contributionId"]
    again = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    ids = [item["contributionId"] for item in again["contributions"]]
    assert recreated["contributionId"] in ids
    assert again["countsByType"]["verify"] == 1
    other_version = await get_public_katki_read(db, slug=SLUG, journey_version=2)
    assert other_version["totalVisibleCount"] == 0


def test_create_route_requires_auth_exact_version_and_forbids_extra_fields():
    from fastapi.testclient import TestClient

    from backend.auth.mirror_entitlement import require_mirror_authenticated_user
    from backend.core.utils.dependencies import get_db
    from backend.main import app

    actor_id = uuid4()

    async def _fake_db():
        yield AsyncMock()

    async def _actor():
        return SimpleNamespace(id=actor_id)

    app.dependency_overrides[get_db] = _fake_db
    seen: dict = {}

    async def _capture(_db, **kwargs):
        seen.update(kwargs)
        return {
            "contributionId": "11111111-1111-4111-8111-111111111111",
            "type": "correction",
            "body": BODY_20,
            "sourceNote": None,
            "createdAt": "2026-10-01T12:00:00+00:00",
            "contributor": {
                "displayName": "Ada",
                "publicAvatarUrl": None,
                "publicAvatarRevision": 0,
                "publicHonorific": "Meraklı",
            },
        }

    try:
        with patch(
            "backend.routers.mirror_network.rate_limit_standalone",
            new=AsyncMock(return_value=None),
        ), patch(
            "backend.routers.mirror_network.create_katki",
            new=_capture,
        ):
            client = TestClient(app)
            anonymous = client.post(
                f"/api/mirror-network/{SLUG}/contributions",
                json={"journeyVersion": 3, "type": "verify"},
            )
            assert anonymous.status_code == 401
            assert anonymous.json()["detail"]["code"] == "auth_required"
            assert seen == {}

            app.dependency_overrides[require_mirror_authenticated_user] = _actor
            missing_version = client.post(
                f"/api/mirror-network/{SLUG}/contributions",
                json={"type": "verify"},
            )
            assert missing_version.status_code == 422
            assert seen == {}

            forbidden = client.post(
                f"/api/mirror-network/{SLUG}/contributions",
                json={
                    "journeyVersion": 3,
                    "type": "correction",
                    "body": BODY_20,
                    "userId": str(uuid4()),
                    "stepIndex": 2,
                },
            )
            assert forbidden.status_code == 422
            assert seen == {}

            created = client.post(
                f"/api/mirror-network/{SLUG}/contributions",
                json={
                    "journeyVersion": 3,
                    "type": "correction",
                    "body": BODY_20,
                },
            )
            assert created.status_code == 200
            assert set(created.json()) == PUBLIC_KEYS
            assert seen["journey_version"] == 3
            assert seen["slug"] == SLUG
            assert _same(seen["actor_user_id"], actor_id)
            assert "userId" not in seen["raw_fields"]
            assert "contributor_user_id" not in seen["raw_fields"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_mirror_authenticated_user, None)


def _toggle_keys(payload: dict) -> None:
    assert set(payload) == {
        "slug",
        "journeyVersion",
        "viewerHasActiveVerify",
        "totalVisibleCount",
        "contentVisibleCount",
        "countsByType",
    }
    assert "contributionId" not in payload
    assert "userId" not in payload
    assert "viewerId" not in payload


@pytest.mark.asyncio
async def test_verify_toggle_create_withdraw_and_recreate(db, parents):
    _owner, contributor, other = await _ready(db, parents, SLUG, OTHER_SLUG)
    idle = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )
    _toggle_keys(idle)
    assert idle["viewerHasActiveVerify"] is True
    assert idle["countsByType"]["verify"] == 1
    assert idle["totalVisibleCount"] == 1
    assert idle["contentVisibleCount"] == 0

    active = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )
    assert active["viewerHasActiveVerify"] is False
    assert active["countsByType"]["verify"] == 0
    assert active["totalVisibleCount"] == 0

    again = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )
    assert again["viewerHasActiveVerify"] is True
    assert again["countsByType"]["verify"] == 1
    stored = (
        await db.execute(
            select(YansiContribution.__table__).where(
                YansiContribution.__table__.c.contributor_user_id == contributor["id"],
                YansiContribution.__table__.c.contribution_type == "verify",
            )
        )
    ).mappings().all()
    assert len(stored) == 2
    assert sum(1 for row in stored if row["visibility"] != "withdrawn") == 1


@pytest.mark.asyncio
async def test_verify_toggle_withdraws_hidden_without_changing_public_count(db, parents):
    owner, contributor, other = await _ready(db, parents)
    created = await _create(db, contributor, now=T0)
    await owner_hide_katki(
        db,
        public_id=UUID(created["contributionId"]),
        actor_user_id=owner["id"],
    )
    hidden = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )
    assert hidden["viewerHasActiveVerify"] is False
    assert hidden["countsByType"]["verify"] == 0
    assert hidden["totalVisibleCount"] == 0

    trust_created = await _create(db, other, now=T0)
    await trust_hide_katki(db, public_id=UUID(trust_created["contributionId"]))
    before = await get_public_katki_read(db, slug=SLUG, journey_version=1, viewer_user_id=other["id"])
    assert before["viewerHasActiveVerify"] is True
    assert before["countsByType"]["verify"] == 0
    trust = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=other["id"]
    )
    assert trust["viewerHasActiveVerify"] is False
    assert trust["countsByType"]["verify"] == 0


@pytest.mark.asyncio
async def test_verify_toggle_leaves_other_user_version_and_slug(db, parents):
    _owner, contributor, other = await _ready(db, parents, SLUG, OTHER_SLUG)
    await _create(db, other, now=T0)
    await _create(db, contributor, slug=OTHER_SLUG, now=T0)
    await _create(db, contributor, version=2, now=T0)
    toggled = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )
    assert toggled["viewerHasActiveVerify"] is True
    assert toggled["countsByType"]["verify"] == 2
    other_still = await get_public_katki_read(
        db, slug=SLUG, journey_version=1, viewer_user_id=other["id"]
    )
    assert other_still["viewerHasActiveVerify"] is True
    assert other_still["countsByType"]["verify"] == 2
    other_slug = await get_public_katki_read(
        db, slug=OTHER_SLUG, journey_version=1, viewer_user_id=contributor["id"]
    )
    assert other_slug["viewerHasActiveVerify"] is True
    assert other_slug["countsByType"]["verify"] == 1
    other_version = await get_public_katki_read(
        db, slug=SLUG, journey_version=2, viewer_user_id=contributor["id"]
    )
    assert other_version["viewerHasActiveVerify"] is True
    assert other_version["countsByType"]["verify"] == 1


@pytest.mark.asyncio
async def test_repeated_verify_toggle_stays_consistent(db, parents):
    _owner, contributor, _other = await _ready(db, parents)
    last = None
    for _ in range(4):
        last = await toggle_viewer_verify(
            db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
        )
    assert last["viewerHasActiveVerify"] is False
    table = YansiContribution.__table__
    active = (
        await db.execute(
            select(func.count())
            .select_from(table)
            .where(
                table.c.contributor_user_id == contributor["id"],
                table.c.contribution_type == "verify",
                table.c.visibility != "withdrawn",
            )
        )
    ).scalar_one()
    assert int(active) == 0


@pytest.mark.asyncio
async def test_verify_toggle_withdraw_path_uses_account_lock(db, parents, monkeypatch):
    _owner, contributor, _other = await _ready(db, parents)
    await _create(db, contributor, now=T0)
    lock = AsyncMock()
    monkeypatch.setattr(
        "backend.services.mirror_network.katki_create._acquire_create_lock",
        lock,
    )

    toggled = await toggle_viewer_verify(
        db, slug=SLUG, journey_version=1, actor_user_id=contributor["id"]
    )

    assert toggled["viewerHasActiveVerify"] is False
    lock.assert_awaited_once()
    assert lock.await_args.args[1] == contributor["id"]


@pytest.mark.asyncio
async def test_public_honorific_comes_from_the_user_column(db, parents):
    from sqlalchemy import text

    _owner, contributor, _other = await _ready(db, parents)
    await db.execute(text("ALTER TABLE production_users ADD COLUMN public_honorific VARCHAR(32)"))
    await db.execute(
        text("UPDATE production_users SET public_honorific = 'bilgin' WHERE email = :email"),
        {"email": "contributor@example.com"},
    )
    await db.commit()
    created = await _create(db, contributor, contribution_type="correction", body=BODY_20, now=T0)
    assert created["contributor"]["publicHonorific"] == "Bilgin"
    visible = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert visible["contributions"][0]["contributor"]["publicHonorific"] == "Bilgin"
    raw = str(visible)
    assert "contributor@example.com" not in raw
    assert "userId" not in visible["contributions"][0]["contributor"]


def test_verify_toggle_route_rejects_anonymous_and_hides_identity():
    from fastapi.testclient import TestClient

    from backend.auth.mirror_entitlement import require_mirror_authenticated_user
    from backend.core.utils.dependencies import get_db
    from backend.main import app

    actor_id = uuid4()

    async def _fake_db():
        yield AsyncMock()

    async def _actor():
        return SimpleNamespace(id=actor_id)

    app.dependency_overrides[get_db] = _fake_db
    seen: dict = {}

    async def _capture(_db, **kwargs):
        seen.update(kwargs)
        return {
            "slug": SLUG,
            "journeyVersion": 1,
            "viewerHasActiveVerify": True,
            "totalVisibleCount": 1,
            "contentVisibleCount": 0,
            "countsByType": {name: 1 if name == "verify" else 0 for name in TYPES},
        }

    try:
        client = TestClient(app)
        anonymous = client.post(
            f"/api/mirror-network/{SLUG}/contributions/verify-toggle",
            json={"journeyVersion": 1},
        )
        assert anonymous.status_code == 401
        assert seen == {}

        app.dependency_overrides[require_mirror_authenticated_user] = _actor
        with patch(
            "backend.routers.mirror_network.toggle_viewer_verify",
            new=_capture,
        ):
            extra = client.post(
                f"/api/mirror-network/{SLUG}/contributions/verify-toggle",
                json={"journeyVersion": 1, "contributionId": str(uuid4()), "userId": str(actor_id)},
            )
            assert extra.status_code == 422
            ok = client.post(
                f"/api/mirror-network/{SLUG}/contributions/verify-toggle",
                json={"journeyVersion": 1},
            )
            assert ok.status_code == 200
            body = ok.json()
            assert set(body) == {
                "slug",
                "journeyVersion",
                "viewerHasActiveVerify",
                "totalVisibleCount",
                "contentVisibleCount",
                "countsByType",
            }
            assert seen["actor_user_id"] == actor_id
            assert seen["journey_version"] == 1
            assert "contribution_id" not in seen
            assert "userId" not in seen
            assert str(actor_id) not in ok.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_mirror_authenticated_user, None)
