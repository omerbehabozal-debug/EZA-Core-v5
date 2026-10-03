# -*- coding: utf-8 -*-
"""Katkılar Phase 1 — Yansı target resolution and contribution persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, insert, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.compiler import compiles


@compiles(PGUUID, "sqlite")
def _compile_pg_uuid_for_sqlite(_type, _compiler, **_kw):
    """Phase 1 persistence tests run on SQLite. Production stays postgresql.UUID."""
    return "CHAR(32)"

from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    KATKI_CONTRIBUTION_TYPES,
    KATKI_REPORT_REASONS,
    KATKI_VISIBILITIES,
    MirrorNetworkNode,
    YansiContribution,
    YansiContributionReport,
)
from backend.models.production import User
from backend.services.mirror_network.katki_target import (
    KATKI_FORBIDDEN_ATTACHMENT_KEYS,
    KatkiResolvedTarget,
    KatkiTargetResolutionError,
    reject_forbidden_katki_attachment,
    resolve_katki_target,
)
from backend.services.mirror_network.yansi_report import ALLOWED_REASONS


def _steps(n: int = 6) -> list[dict]:
    return [
        {
            "stepIndex": i,
            "publicQuestion": f"Q{i}?",
            "publicAnswer": f"A{i}",
        }
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
        "slug": "beynin-gece",
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
    steps = {(node.slug, 1): _steps(), (node.slug, 2): _steps()}

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


@pytest.mark.asyncio
async def test_v1_and_v2_are_different_targets(katki_world):
    first = await resolve_katki_target(None, slug="beynin-gece", journey_version=1)
    second = await resolve_katki_target(None, slug="  BEYNIN-GECE  ", journey_version=2)
    assert first.journey_version == 1
    assert second.journey_version == 2
    assert first.slug == second.slug == "beynin-gece"
    assert first.node_id == second.node_id == katki_world["node_id"]
    assert (first.slug, first.journey_version) != (second.slug, second.journey_version)
    assert isinstance(first, KatkiResolvedTarget)


@pytest.mark.asyncio
async def test_missing_version_fails(katki_world):
    with pytest.raises(KatkiTargetResolutionError) as missing:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=None)
    assert missing.value.code == "missing_version"
    with pytest.raises(KatkiTargetResolutionError) as zero:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=0)
    assert zero.value.code == "missing_version"


@pytest.mark.asyncio
async def test_unknown_version_does_not_substitute_latest(katki_world):
    node = katki_world["node"]
    assert node.journey_version == 2
    with pytest.raises(KatkiTargetResolutionError) as unknown:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=9)
    assert unknown.value.code == "unknown_version"
    # Version 1 is archived, not replaced by the current node version.
    archived = await resolve_katki_target(None, slug="beynin-gece", journey_version=1)
    assert archived.journey_version == 1


@pytest.mark.asyncio
async def test_only_current_seal_does_not_satisfy_an_older_version(katki_world):
    owner = katki_world["owner"]
    node = katki_world["node"]
    node.journey_version = 2
    node.private_payload = {
        "intelligenceBrief": {
            "frozenJourneyArtifact": _seal(2, owner),
            "frozenJourneyVersions": {"2": _seal(2, owner)},
            "freezeStatus": "frozen",
        }
    }
    with pytest.raises(KatkiTargetResolutionError) as missing_old:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=1)
    assert missing_old.value.code == "unknown_version"
    current = await resolve_katki_target(None, slug="beynin-gece", journey_version=2)
    assert current.journey_version == 2


@pytest.mark.asyncio
async def test_hidden_unpublished_and_not_replay_ready_fail(katki_world):
    node = katki_world["node"]

    node.visibility = "public"
    node.safety_status = "restricted"
    with pytest.raises(KatkiTargetResolutionError) as hidden:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=2)
    assert hidden.value.code == "hidden"

    node.safety_status = "open"
    node.visibility = "private"
    with pytest.raises(KatkiTargetResolutionError) as unpublished:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=2)
    assert unpublished.value.code == "unpublished"

    node.visibility = "public"
    node.published_at = None
    with pytest.raises(KatkiTargetResolutionError) as not_published:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=2)
    assert not_published.value.code == "not_published"

    node.published_at = datetime(2026, 10, 1, tzinfo=timezone.utc)
    katki_world["steps"][(node.slug, 2)] = _steps(5)
    with pytest.raises(KatkiTargetResolutionError) as not_ready:
        await resolve_katki_target(None, slug="beynin-gece", journey_version=2)
    assert not_ready.value.code == "not_replay_ready"


def test_target_has_no_step_or_message_identity():
    fields = set(KatkiResolvedTarget.__dataclass_fields__)
    assert fields == {"slug", "journey_version", "node_id", "owner_user_id"}
    column_names = {column.name for column in YansiContribution.__table__.columns}
    for forbidden in (
        "scope",
        "step_index",
        "source_conversation_id",
        "source_user_message_id",
        "source_assistant_message_id",
        "scene_asset_id",
        "generation_id",
    ):
        assert forbidden not in column_names
    with pytest.raises(KatkiTargetResolutionError) as rejected:
        reject_forbidden_katki_attachment(
            {"slug": "beynin-gece", "journeyVersion": 2, "stepIndex": 3}
        )
    assert rejected.value.code == "forbidden_attachment"
    assert "stepIndex" in KATKI_FORBIDDEN_ATTACHMENT_KEYS
    reject_forbidden_katki_attachment({"slug": "beynin-gece", "journeyVersion": 2})


def test_report_reasons_match_existing_yansi_report_vocabulary():
    assert set(KATKI_REPORT_REASONS) == set(ALLOWED_REASONS)
    assert set(KATKI_CONTRIBUTION_TYPES) == {
        "verify",
        "correction",
        "additional_information",
        "different_perspective",
    }
    assert set(KATKI_VISIBILITIES) == {
        "visible",
        "hidden_by_owner",
        "hidden_by_trust",
        "withdrawn",
    }


@pytest.fixture
def contribution_db():
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _enable_fk(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    User.__table__.create(engine)
    MirrorNetworkNode.__table__.create(engine)
    YansiContribution.__table__.create(engine)
    YansiContributionReport.__table__.create(engine)
    try:
        yield engine
    finally:
        engine.dispose()


def _person(email: str) -> dict:
    return {
        "id": uuid4(),
        "email": email,
        "role": "user",
        "is_active": True,
        "mirror_plan": "free",
    }


def _node_row(owner_id) -> dict:
    return {
        "id": uuid4(),
        "slug": "beynin-gece",
        "user_id": owner_id,
        "visibility": "public",
        "safety_status": "open",
        "card_title": "Beynin",
        "card_date": "2026-10-01",
        "public_payload": {"publicTitle": "Beynin"},
        "private_payload": {},
        "artifact_kind": ARTIFACT_KIND_JOURNEY_V1,
        "journey_version": 2,
        "published_at": datetime(2026, 10, 1, tzinfo=timezone.utc),
    }


def _contribution(owner_id, *, version=2, contribution_type="verify", visibility="visible", **kwargs):
    return {
        "id": uuid4(),
        "public_id": kwargs.get("public_id", uuid4()),
        "slug": "beynin-gece",
        "journey_version": version,
        "contribution_type": contribution_type,
        "contributor_user_id": owner_id,
        "visibility": visibility,
        "body": kwargs.get("body"),
        "source_note": kwargs.get("source_note"),
        "hidden_by_user_id": kwargs.get("hidden_by_user_id"),
    }


def _seed(conn, label: str, *, with_node: bool = False):
    owner = _person(f"owner-{label}@example.com")
    other = _person(f"other-{label}@example.com")
    conn.execute(insert(User.__table__), [owner, other])
    if with_node:
        conn.execute(insert(MirrorNetworkNode.__table__), [_node_row(owner["id"])])
    return owner, other


def test_contribution_rows_versions_and_reports(contribution_db):
    contrib = YansiContribution.__table__
    reports = YansiContributionReport.__table__

    with contribution_db.begin() as conn:
        owner, other = _seed(conn, "types", with_node=True)
        conn.execute(
            insert(contrib),
            [
                _contribution(owner["id"], contribution_type=kind, body=None, source_note=None)
                for kind in KATKI_CONTRIBUTION_TYPES
            ],
        )
        stored_types = set(conn.execute(select(contrib.c.contribution_type)).scalars())
        assert stored_types == set(KATKI_CONTRIBUTION_TYPES)
        conn.execute(
            insert(contrib),
            [
                _contribution(
                    other["id"],
                    version=1,
                    contribution_type=contribution_type,
                    visibility=visibility,
                    hidden_by_user_id=owner["id"] if visibility != "withdrawn" else None,
                )
                for contribution_type, visibility in (
                    ("correction", "hidden_by_owner"),
                    ("additional_information", "hidden_by_trust"),
                    ("verify", "withdrawn"),
                )
            ],
        )
        stored_visibility = set(conn.execute(select(contrib.c.visibility)).scalars())
        assert stored_visibility >= set(KATKI_VISIBILITIES)
        shared_public_id = uuid4()
        conn.execute(
            insert(contrib),
            [
                _contribution(
                    owner["id"],
                    version=3,
                    contribution_type="verify",
                    public_id=shared_public_id,
                )
            ],
        )
        with pytest.raises(IntegrityError):
            conn.execute(
                insert(contrib),
                [
                    _contribution(
                        other["id"],
                        version=4,
                        contribution_type="correction",
                        public_id=shared_public_id,
                    )
                ],
            )

    with contribution_db.begin() as conn:
        owner, _other = _seed(conn, "duplicate")
        conn.execute(insert(contrib), [_contribution(owner["id"], contribution_type="verify")])
        with pytest.raises(IntegrityError):
            conn.execute(insert(contrib), [_contribution(owner["id"], contribution_type="verify")])

    with contribution_db.begin() as conn:
        owner, other = _seed(conn, "versions")
        conn.execute(
            insert(contrib),
            [
                _contribution(owner["id"], contribution_type="verify", version=2),
                _contribution(owner["id"], contribution_type="correction", version=2),
                _contribution(other["id"], contribution_type="verify", version=2),
                _contribution(owner["id"], contribution_type="verify", version=1),
            ],
        )
        scoped = conn.execute(
            select(contrib.c.id).where(
                contrib.c.contributor_user_id.in_([owner["id"], other["id"]])
            )
        ).all()
        assert len(scoped) == 4
        withdrawn = _contribution(
            owner["id"],
            contribution_type="additional_information",
            visibility="withdrawn",
        )
        conn.execute(insert(contrib), [withdrawn])
        active = _contribution(
            owner["id"],
            contribution_type="additional_information",
            visibility="visible",
        )
        conn.execute(insert(contrib), [active])
        visible_rows = conn.execute(
            select(contrib.c.visibility).where(
                contrib.c.contributor_user_id == owner["id"],
                contrib.c.contribution_type == "additional_information",
                contrib.c.visibility != "withdrawn",
            )
        ).scalars().all()
        assert visible_rows == ["visible"]
        conn.execute(
            insert(reports),
            [
                {
                    "id": uuid4(),
                    "contribution_id": active["id"],
                    "reporter_user_id": other["id"],
                    "reason": "misleading",
                },
                {
                    "id": uuid4(),
                    "contribution_id": active["id"],
                    "reporter_user_id": owner["id"],
                    "reason": "other",
                },
            ],
        )
        still_visible = conn.execute(
            select(contrib.c.visibility).where(contrib.c.id == active["id"])
        ).scalar_one()
        assert still_visible == "visible"
        with pytest.raises(IntegrityError):
            conn.execute(
                insert(reports),
                [
                    {
                        "id": uuid4(),
                        "contribution_id": active["id"],
                        "reporter_user_id": other["id"],
                        "reason": "privacy",
                    }
                ],
            )
