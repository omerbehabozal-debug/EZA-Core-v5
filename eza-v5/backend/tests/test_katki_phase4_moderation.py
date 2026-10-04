# -*- coding: utf-8 -*-
"""Katkılar Phase 4 — withdraw, report, owner hide/restore, trust hide/restore."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.services.mirror_network.katki_target import (
    KatkiResolvedTarget,
    KatkiTargetResolutionError,
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
from backend.services.mirror_network.katki_moderation import (
    KatkiModerationError,
    owner_hide_katki,
    owner_restore_katki,
    report_katki,
    trust_hide_katki,
    trust_restore_katki,
    withdraw_katki,
)
from backend.services.mirror_network.katki_read import get_public_katki_read

SLUG = "beynin-gece"
T0 = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)


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
def readable_parent(monkeypatch):
    owner = uuid4()
    node_id = uuid4()
    node = type("Node", (), {})()
    node.id = node_id
    node.slug = SLUG
    node.user_id = owner
    node.artifact_kind = ARTIFACT_KIND_JOURNEY_V1
    node.journey_version = 2
    node.freeze_status = "frozen"
    node.visibility = "public"
    node.safety_status = "open"
    node.published_at = T0
    node.frozen_at = T0
    node.parent_slug = None
    node.window_index = None
    node.window_start = None
    node.window_end = None
    seals = {"1": _seal(1, owner), "2": _seal(2, owner)}
    node.private_payload = {
        "intelligenceBrief": {
            "frozenJourneyArtifact": seals["2"],
            "frozenJourneyVersions": seals,
            "freezeStatus": "frozen",
        }
    }
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
    return node


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


def _user(email: str) -> dict:
    return {
        "id": uuid4(),
        "email": email,
        "role": "user",
        "is_active": True,
        "mirror_plan": "free",
    }


def _node(owner_id) -> dict:
    return {
        "id": uuid4(),
        "slug": SLUG,
        "user_id": owner_id,
        "visibility": "public",
        "safety_status": "open",
        "card_title": "Beynin",
        "card_date": "2026-10-01",
        "public_payload": {"publicTitle": "Beynin"},
        "private_payload": {},
        "artifact_kind": ARTIFACT_KIND_JOURNEY_V1,
        "journey_version": 2,
        "published_at": T0,
    }


def _contribution(owner_id, *, contributor_id, visibility="visible", version=1, body="body", note="note"):
    return {
        "id": uuid4(),
        "public_id": uuid4(),
        "slug": SLUG,
        "journey_version": version,
        "contribution_type": "verify",
        "body": body,
        "source_note": note,
        "contributor_user_id": contributor_id,
        "visibility": visibility,
        "created_at": T0,
        "hidden_by_user_id": owner_id if visibility == "hidden_by_owner" else None,
    }


async def _seed(db, *, visibility="visible", version=1, body="kept-body", note="kept-note"):
    owner = _user("owner@example.com")
    contributor = _user("contributor@example.com")
    other = _user("other@example.com")
    await db.execute(insert(User.__table__), [owner, contributor, other])
    await db.execute(insert(MirrorNetworkNode.__table__), [_node(owner["id"])])
    row = _contribution(
        owner["id"],
        contributor_id=contributor["id"],
        visibility=visibility,
        version=version,
        body=body,
        note=note,
    )
    await db.execute(insert(YansiContribution.__table__), [row])
    await db.commit()
    return owner, contributor, other, row


async def _stored(db, public_id):
    table = YansiContribution.__table__
    result = await db.execute(select(table).where(table.c.public_id == public_id))
    return result.mappings().one()


def _resolved(slug, version):
    async def _target(_db, *, slug, journey_version):
        return KatkiResolvedTarget(
            slug=slug,
            journey_version=int(journey_version),
            node_id=uuid4(),
            owner_user_id=uuid4(),
        )

    return _target


async def test_contributor_withdraws_visible_owner_hidden_and_trust_hidden(db):
    owner, contributor, _other, visible = await _seed(db, body="text-visible")
    rows = [visible]
    for version, visibility in ((2, "hidden_by_owner"), (3, "hidden_by_trust")):
        row = _contribution(
            owner["id"],
            contributor_id=contributor["id"],
            visibility=visibility,
            version=version,
            body=f"text-{visibility}",
        )
        row["contribution_type"] = "correction" if visibility == "hidden_by_owner" else "additional_information"
        await db.execute(insert(YansiContribution.__table__), [row])
        rows.append(row)
    await db.commit()
    for row in rows:
        result = await withdraw_katki(
            db, public_id=row["public_id"], actor_user_id=contributor["id"]
        )
        assert result.status == "withdrawn"
        assert result.visibility == "withdrawn"
        stored = await _stored(db, row["public_id"])
        assert stored["visibility"] == "withdrawn"
        assert stored["withdrawn_at"] is not None
        assert stored["body"] == row["body"]
        with pytest.raises(KatkiModerationError) as again:
            await withdraw_katki(
                db, public_id=row["public_id"], actor_user_id=contributor["id"]
            )
        assert again.value.code == "already_withdrawn"
        assert again.value.status_code == 409


async def test_withdraw_denies_another_contributor(db):
    _owner, _contributor, other, row = await _seed(db)
    with pytest.raises(KatkiModerationError) as denied:
        await withdraw_katki(db, public_id=row["public_id"], actor_user_id=other["id"])
    assert denied.value.code == "forbidden"
    assert denied.value.status_code == 403
    assert (await _stored(db, row["public_id"]))["visibility"] == "visible"


async def test_report_once_does_not_hide_or_change_the_public_count(db, readable_parent):
    owner, contributor, other, row = await _seed(db, version=1)
    reporter = _user("reporter@example.com")
    await db.execute(insert(User.__table__), [reporter])
    await db.commit()
    with patch(
        "backend.services.mirror_network.katki_moderation.resolve_katki_target",
        new=_resolved(SLUG, 1),
    ):
        created = await report_katki(
            db,
            public_id=row["public_id"],
            reporter_user_id=reporter["id"],
            reason="misleading",
        )
        assert created.status == "reported"
        assert created.reason == "misleading"
        with pytest.raises(KatkiModerationError) as duplicate:
            await report_katki(
                db,
                public_id=row["public_id"],
                reporter_user_id=reporter["id"],
                reason="privacy",
            )
        assert duplicate.value.code == "already_reported"
        second = await report_katki(
            db,
            public_id=row["public_id"],
            reporter_user_id=other["id"],
            reason="other",
        )
        assert second.status == "reported"

    stored = await _stored(db, row["public_id"])
    assert stored["visibility"] == "visible"
    assert stored["body"] == "kept-body"
    readable_parent.user_id = owner["id"]
    payload = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert payload["totalVisibleCount"] == 1
    assert payload["countsByType"]["verify"] == 1
    assert payload["contributions"][0]["body"] == "kept-body"
    dumped_keys = set(payload["contributions"][0])
    assert "reporter_user_id" not in dumped_keys
    reports = await db.execute(select(YansiContributionReport.__table__.c.reporter_user_id))
    assert len(reports.all()) == 2


async def test_invalid_reason_and_inaccessible_parent_do_not_report(db):
    _owner, _contributor, reporter, row = await _seed(db)
    with pytest.raises(KatkiModerationError) as invalid:
        await report_katki(
            db,
            public_id=row["public_id"],
            reporter_user_id=reporter["id"],
            reason="spam",
        )
    assert invalid.value.code == "invalid_reason"
    assert invalid.value.status_code == 400

    async def _closed(_db, *, slug, journey_version):
        raise KatkiTargetResolutionError("unpublished")

    with patch(
        "backend.services.mirror_network.katki_moderation.resolve_katki_target",
        new=_closed,
    ):
        with pytest.raises(KatkiModerationError) as closed:
            await report_katki(
                db,
                public_id=row["public_id"],
                reporter_user_id=reporter["id"],
                reason="privacy",
            )
    assert closed.value.code == "not_found"
    stored = await _stored(db, row["public_id"])
    assert stored["visibility"] == "visible"


async def test_owner_hide_and_restore_round_trip(db, readable_parent):
    owner, contributor, other, row = await _seed(db, version=1, body="shown")
    with pytest.raises(KatkiModerationError) as stranger:
        await owner_hide_katki(db, public_id=row["public_id"], actor_user_id=other["id"])
    assert stranger.value.code == "forbidden"

    hidden = await owner_hide_katki(
        db, public_id=row["public_id"], actor_user_id=owner["id"]
    )
    assert hidden.visibility == "hidden_by_owner"
    stored = await _stored(db, row["public_id"])
    assert stored["hidden_by_user_id"] == owner["id"] or str(stored["hidden_by_user_id"]).replace("-", "") == owner["id"].hex
    assert stored["hidden_at"] is not None
    assert stored["body"] == "shown"
    with pytest.raises(KatkiModerationError) as again:
        await owner_hide_katki(db, public_id=row["public_id"], actor_user_id=owner["id"])
    assert again.value.code == "already_hidden"

    readable_parent.user_id = owner["id"]
    hidden_read = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert hidden_read["totalVisibleCount"] == 0
    assert hidden_read["countsByType"]["verify"] == 0
    assert hidden_read["contributions"] == []

    restored = await owner_restore_katki(
        db, public_id=row["public_id"], actor_user_id=owner["id"]
    )
    assert restored.status == "restored"
    assert restored.visibility == "visible"
    cleared = await _stored(db, row["public_id"])
    assert cleared["hidden_at"] is None
    assert cleared["hidden_by_user_id"] is None
    visible_read = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert visible_read["totalVisibleCount"] == 1
    assert visible_read["countsByType"]["verify"] == 1
    assert visible_read["contributions"][0]["contributionId"] == str(row["public_id"])
    assert "contributor@example.com" not in str(visible_read)


async def test_owner_cannot_restore_trust_hide_or_withdrawal(db):
    owner, contributor, _other, trust_row = await _seed(db, visibility="hidden_by_trust")
    with pytest.raises(KatkiModerationError) as trust_denied:
        await owner_restore_katki(
            db, public_id=trust_row["public_id"], actor_user_id=owner["id"]
        )
    assert trust_denied.value.code == "transition_forbidden"
    await withdraw_katki(
        db, public_id=trust_row["public_id"], actor_user_id=contributor["id"]
    )
    with pytest.raises(KatkiModerationError) as withdrawn_denied:
        await owner_restore_katki(
            db, public_id=trust_row["public_id"], actor_user_id=owner["id"]
        )
    assert withdrawn_denied.value.code == "transition_forbidden"
    with pytest.raises(KatkiModerationError) as trust_restore:
        await trust_restore_katki(db, public_id=trust_row["public_id"])
    assert trust_restore.value.code == "transition_forbidden"


async def test_trust_hide_and_restore_do_not_rewrite_text_or_invent_a_user(db, readable_parent):
    owner, _contributor, _other, row = await _seed(db, version=1, body="original", note="source")
    hidden = await trust_hide_katki(db, public_id=row["public_id"])
    assert hidden.visibility == "hidden_by_trust"
    stored = await _stored(db, row["public_id"])
    assert stored["body"] == "original"
    assert stored["source_note"] == "source"
    assert stored["hidden_by_user_id"] is None
    assert stored["hidden_at"] is not None
    with pytest.raises(KatkiModerationError) as again:
        await trust_hide_katki(db, public_id=row["public_id"])
    assert again.value.code == "already_hidden"

    readable_parent.user_id = owner["id"]
    after_hide = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert after_hide["totalVisibleCount"] == 0
    assert after_hide["contributions"] == []

    restored = await trust_restore_katki(db, public_id=row["public_id"])
    assert restored.visibility == "visible"
    assert (await _stored(db, row["public_id"]))["hidden_by_user_id"] is None
    after_restore = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert after_restore["totalVisibleCount"] == 1
    assert after_restore["contributions"][0]["body"] == "original"
    assert after_restore["contributions"][0]["sourceNote"] == "source"


async def test_trust_does_not_override_owner_hide_or_withdrawal(db):
    owner, contributor, _other, row = await _seed(db)
    await owner_hide_katki(db, public_id=row["public_id"], actor_user_id=owner["id"])
    with pytest.raises(KatkiModerationError) as hide_denied:
        await trust_hide_katki(db, public_id=row["public_id"])
    assert hide_denied.value.code == "transition_forbidden"
    with pytest.raises(KatkiModerationError) as restore_denied:
        await trust_restore_katki(db, public_id=row["public_id"])
    assert restore_denied.value.code == "transition_forbidden"
    assert (await _stored(db, row["public_id"]))["visibility"] == "hidden_by_owner"

    await withdraw_katki(db, public_id=row["public_id"], actor_user_id=contributor["id"])
    for action in (
        trust_hide_katki(db, public_id=row["public_id"]),
        trust_restore_katki(db, public_id=row["public_id"]),
        owner_hide_katki(db, public_id=row["public_id"], actor_user_id=owner["id"]),
        owner_restore_katki(db, public_id=row["public_id"], actor_user_id=owner["id"]),
    ):
        with pytest.raises(KatkiModerationError) as blocked:
            await action
        assert blocked.value.code == "transition_forbidden"
    assert (await _stored(db, row["public_id"]))["visibility"] == "withdrawn"


async def test_withdrawal_drops_the_public_row_for_that_version_only(db, readable_parent):
    owner, contributor, _other, current = await _seed(db, version=1, body="gone")
    other_version = _contribution(
        owner["id"],
        contributor_id=contributor["id"],
        version=2,
        body="stays",
    )
    other_version["contribution_type"] = "correction"
    await db.execute(insert(YansiContribution.__table__), [other_version])
    await db.commit()
    readable_parent.user_id = owner["id"]
    await withdraw_katki(db, public_id=current["public_id"], actor_user_id=contributor["id"])
    version_one = await get_public_katki_read(db, slug=SLUG, journey_version=1)
    version_two = await get_public_katki_read(db, slug=SLUG, journey_version=2)
    assert version_one["totalVisibleCount"] == 0
    assert version_one["contributions"] == []
    assert version_two["totalVisibleCount"] == 1
    assert version_two["countsByType"]["correction"] == 1
    assert version_two["contributions"][0]["body"] == "stays"


async def test_private_parent_stays_closed_after_moderation(db, readable_parent):
    owner, _contributor, _other, row = await _seed(db, version=1, body="secret-body")
    readable_parent.user_id = owner["id"]
    readable_parent.visibility = "private"
    with pytest.raises(Exception) as closed:
        await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert closed.value.status_code == 404
    await owner_hide_katki(db, public_id=row["public_id"], actor_user_id=owner["id"])
    await owner_restore_katki(db, public_id=row["public_id"], actor_user_id=owner["id"])
    with pytest.raises(Exception) as still_closed:
        await get_public_katki_read(db, slug=SLUG, journey_version=1)
    assert still_closed.value.status_code == 404
    assert "secret-body" not in str(still_closed.value)


def test_contribution_routes_and_trust_key_is_required():
    from fastapi.testclient import TestClient

    from backend.main import app

    posts = {
        route.path
        for route in app.routes
        if "POST" in (getattr(route, "methods", set()) or set())
        and "contribution" in getattr(route, "path", "")
    }
    assert posts == {
        "/api/mirror-network/contributions/{contribution_id}/withdraw",
        "/api/mirror-network/contributions/{contribution_id}/report",
        "/api/mirror-network/contributions/{contribution_id}/hide",
        "/api/mirror-network/contributions/{contribution_id}/restore",
        "/api/mirror-network/contributions/{contribution_id}/trust-hide",
        "/api/mirror-network/contributions/{contribution_id}/trust-restore",
        "/api/mirror-network/{slug}/contributions",
    }
    contribution_id = str(uuid4())
    with patch(
        "backend.routers.mirror_network.rate_limit_standalone",
        new=AsyncMock(return_value=None),
    ):
        client = TestClient(app)
        missing_key = client.post(
            f"/api/mirror-network/contributions/{contribution_id}/trust-hide"
        )
        assert missing_key.status_code == 401
        assert missing_key.json()["detail"]["code"] in {
            "trust_admin_not_configured",
            "trust_admin_unauthorized",
        }
        assert "body" not in missing_key.json()


def test_mutation_responses_do_not_carry_private_fields():
    from backend.services.mirror_network.katki_moderation import (
        KatkiMutationResult,
        KatkiReportResult,
    )

    mutation = KatkiMutationResult(
        status="hidden",
        contribution_id=str(uuid4()),
        visibility="hidden_by_owner",
    )
    report = KatkiReportResult(
        status="reported",
        contribution_id=str(uuid4()),
        reason="privacy",
    )
    assert set(mutation.__dataclass_fields__) == {"status", "contribution_id", "visibility"}
    assert set(report.__dataclass_fields__) == {"status", "contribution_id", "reason"}
