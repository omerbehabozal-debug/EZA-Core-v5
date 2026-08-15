# -*- coding: utf-8 -*-
"""Phase 6.0 — durable Yansı experience event ingest + dedupe."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Shared Base mapper registry requires dependent classes before sqlite create.
from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401

from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.yansi_experience_events import (
    YansiExperienceIngestError,
    ingest_yansi_experience_event,
    list_yansi_experience_events,
    payload_has_forbidden_fields,
    synthetic_started_event_id,
)

PRIVACY_ABSENT_COLUMNS = {
    "public_question",
    "publicanswer",
    "public_answer",
    "eza_snapshot",
    "ezasnapshot",
    "behavioral_vector",
    "relationship_map",
    "relationshipmap",
    "prompt",
    "response",
    "lineage_proof_token",
    "lineageprooftoken",
    "guest_token",
    "guesttoken",
    "ip",
    "raw_ip",
    "user_agent",
    "useragent",
    "conversation_id",
}


def _artifact(slug: str, version: int = 1, selected: int = 8, replay_ready: bool = True):
    return {
        "slug": slug,
        "journeyVersion": version,
        "selectedCount": selected,
        "replayReady": replay_ready,
        "artifactKind": "journey_v1",
    }


ARTIFACTS = {
    ("yansi-a", 1): _artifact("yansi-a", 1, 8),
    ("yansi-a", 2): _artifact("yansi-a", 2, 8),
    ("yansi-b", 1): _artifact("yansi-b", 1, 6),
    ("malformed", 1): _artifact("malformed", 1, 3),
    ("not-ready", 1): _artifact("not-ready", 1, 8, replay_ready=False),
}


async def _lookup(_db, *, slug: str, journey_version: int | None = None):
    key_slug = (slug or "").strip().lower()
    if journey_version is None:
        versions = [v for (s, v) in ARTIFACTS if s == key_slug]
        if not versions:
            return None
        return ARTIFACTS[(key_slug, max(versions))]
    return ARTIFACTS.get((key_slug, int(journey_version)))


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiExperienceEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


def _ids():
    return str(uuid.uuid4()), str(uuid.uuid4())


async def _ingest(db, *, slug="yansi-a", viewer_user_id=None, **payload):
    with patch(
        "backend.services.mirror_network.yansi_experience_events.get_public_frozen_journey_artifact",
        new=_lookup,
    ):
        return await ingest_yansi_experience_event(
            db, slug=slug, payload=payload, viewer_user_id=viewer_user_id
        )


async def _start(db, session_id, event_id=None, **extra):
    return await _ingest(
        db,
        eventId=event_id or str(uuid.uuid4()),
        experienceSessionId=session_id,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
        completedStepCount=0,
        occurredAt="2026-08-15T08:00:00Z",
        **extra,
    )


@pytest.mark.asyncio
async def test_a_valid_started_accepted(db):
    sid, eid = _ids()
    result = await _start(db, sid, eid)
    assert result == {"accepted": True, "duplicate": False}
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len(rows) == 1
    assert rows[0].event_type == YANSI_EXPERIENCE_STARTED
    assert rows[0].mirror_slug == "yansi-a"
    assert rows[0].journey_version == 1


@pytest.mark.asyncio
async def test_b_same_event_id_retry_one_row(db):
    sid, eid = _ids()
    first = await _start(db, sid, eid)
    second = await _start(db, sid, eid)
    assert first["duplicate"] is False
    assert second == {"accepted": True, "duplicate": True}
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_c_different_event_id_same_started_session(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    dup = await _start(db, sid)
    assert dup["duplicate"] is True
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len([r for r in rows if r.event_type == YANSI_EXPERIENCE_STARTED]) == 1


@pytest.mark.asyncio
async def test_d_valid_completed_after_started(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    result = await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=1,
        completedStepCount=8,
    )
    assert result["accepted"] is True and result["duplicate"] is False
    types = [r.event_type for r in await list_yansi_experience_events(db, experience_session_id=sid)]
    assert types == [YANSI_EXPERIENCE_STARTED, YANSI_EXPERIENCE_COMPLETED]


@pytest.mark.asyncio
async def test_e_duplicate_completed(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    body = dict(
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=1,
        completedStepCount=8,
    )
    first = await _ingest(db, eventId=str(uuid.uuid4()), **body)
    second = await _ingest(db, eventId=str(uuid.uuid4()), **body)
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len([r for r in rows if r.event_type == YANSI_EXPERIENCE_COMPLETED]) == 1


@pytest.mark.asyncio
async def test_completed_without_started_synthesizes_start(db):
    sid = str(uuid.uuid4())
    result = await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=1,
        completedStepCount=8,
    )
    assert result["accepted"] is True
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    types = [r.event_type for r in rows]
    assert types == [YANSI_EXPERIENCE_STARTED, YANSI_EXPERIENCE_COMPLETED]
    started = rows[0]
    assert started.event_id == synthetic_started_event_id(sid)


@pytest.mark.asyncio
async def test_f_valid_skipped_at_3_of_8(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    result = await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_SKIPPED,
        journeyVersion=1,
        completedStepCount=3,
        destinationSlug="yansi-b",
    )
    assert result == {"accepted": True, "duplicate": False}


@pytest.mark.asyncio
async def test_g_duplicate_skip_transition_deduped(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    body = dict(
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_SKIPPED,
        journeyVersion=1,
        completedStepCount=3,
        destinationSlug="yansi-b",
    )
    first = await _ingest(db, eventId=str(uuid.uuid4()), **body)
    second = await _ingest(db, eventId=str(uuid.uuid4()), **body)
    assert first["duplicate"] is False
    assert second["duplicate"] is True
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len([r for r in rows if r.event_type == YANSI_EXPERIENCE_SKIPPED]) == 1


@pytest.mark.asyncio
async def test_h_skip_then_return_then_complete_retains_both(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_SKIPPED,
        journeyVersion=1,
        completedStepCount=3,
        destinationSlug="yansi-b",
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=1,
        completedStepCount=8,
    )
    types = [r.event_type for r in await list_yansi_experience_events(db, experience_session_id=sid)]
    assert YANSI_EXPERIENCE_SKIPPED in types
    assert YANSI_EXPERIENCE_COMPLETED in types
    assert types.count(YANSI_EXPERIENCE_STARTED) == 1


@pytest.mark.asyncio
async def test_i_skipped_at_zero_rejected(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=0,
            destinationSlug="yansi-b",
        )
    assert exc.value.reason == "skipped_requires_progress"


@pytest.mark.asyncio
async def test_j_skipped_at_selected_count_rejected(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=8,
            destinationSlug="yansi-b",
        )
    assert exc.value.reason == "skipped_requires_incomplete"


@pytest.mark.asyncio
async def test_k_completed_wrong_step_count_rejected(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_COMPLETED,
            journeyVersion=1,
            completedStepCount=7,
        )
    assert exc.value.reason == "invalid_completed_step_count"


@pytest.mark.asyncio
async def test_l_unknown_slug_rejected(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="missing-yansi",
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
        )
    assert exc.value.reason == "frozen_journey_not_found"
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_m_wrong_journey_version_rejected(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=99,
        )
    assert exc.value.reason == "frozen_journey_not_found"


@pytest.mark.asyncio
async def test_n_non_public_target_rejected(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="private-only",
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_o_non_frozen_target_rejected(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="not-ready",
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
        )
    assert exc.value.reason == "not_replay_ready"


@pytest.mark.asyncio
async def test_p_malformed_frozen_artifact_rejected(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="malformed",
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
        )
    assert exc.value.reason == "malformed_frozen_artifact"


@pytest.mark.asyncio
async def test_q_destination_equals_source_rejected(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=3,
            destinationSlug="yansi-a",
        )
    assert exc.value.reason == "invalid_destination"


@pytest.mark.asyncio
async def test_r_invalid_destination_rejected(db):
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=3,
            destinationSlug="not-a-yansi",
        )
    assert exc.value.reason == "invalid_destination"
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_s_authenticated_viewer_accepted(db):
    sid, eid = _ids()
    await _ingest(
        db,
        eventId=eid,
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
        viewer_user_id="user-42",
    )
    row = (await list_yansi_experience_events(db, experience_session_id=sid))[0]
    assert row.viewer_user_id == "user-42"


@pytest.mark.asyncio
async def test_t_guest_viewer_accepted(db):
    sid, eid = _ids()
    await _start(db, sid, eid)
    row = (await list_yansi_experience_events(db, experience_session_id=sid))[0]
    assert row.viewer_user_id is None


def test_u_payload_forbidden_fields_and_schema_privacy():
    assert payload_has_forbidden_fields({"publicQuestion": "secret"})
    assert payload_has_forbidden_fields({"ezaSnapshot": {}})
    assert payload_has_forbidden_fields({"guestToken": "g"})
    assert payload_has_forbidden_fields({"lineageProofToken": "t"})
    cols = {c.name.lower() for c in YansiExperienceEvent.__table__.columns}
    assert not (cols & PRIVACY_ABSENT_COLUMNS)
    assert "event_id" in cols
    assert "experience_session_id" in cols
    assert "mirror_slug" in cols


@pytest.mark.asyncio
async def test_u_ingest_rejects_private_payload_keys(db):
    sid, eid = _ids()
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=eid,
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
            publicQuestion="nope",
        )
    assert exc.value.reason == "privacy_rejected"


@pytest.mark.asyncio
async def test_version_pin_v1_not_reassigned_to_v2(db):
    sid, eid = _ids()
    await _ingest(
        db,
        eventId=eid,
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
    )
    row = (await list_yansi_experience_events(db, experience_session_id=sid))[0]
    assert row.journey_version == 1
    assert ARTIFACTS[("yansi-a", 2)]["journeyVersion"] == 2


@pytest.mark.asyncio
async def test_persisted_row_has_no_content_fields(db):
    sid, eid = _ids()
    await _start(db, sid, eid)
    row = (await list_yansi_experience_events(db, experience_session_id=sid))[0]
    data = {k: v for k, v in row.__dict__.items() if not k.startswith("_")}
    blob = " ".join(str(v).lower() for v in data.values())
    for needle in (
        "publicquestion",
        "bmw soru",
        "guesttoken",
        "relationshipmap",
        "mozilla",
        "127.0.0.1",
    ):
        assert needle not in blob.replace("_", "")


@pytest.mark.asyncio
async def test_client_selected_count_is_ignored(db):
    sid, eid = _ids()
    await _ingest(
        db,
        eventId=eid,
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
        completedStepCount=0,
        selectedCount=99,
    )
    row = (await list_yansi_experience_events(db, experience_session_id=sid))[0]
    assert row.completed_step_count == 0


@pytest.mark.asyncio
async def test_skip_without_started_rejected(db):
    sid = str(uuid.uuid4())
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=3,
            destinationSlug="yansi-b",
        )
    assert exc.value.reason == "started_required"


@pytest.mark.asyncio
async def test_phase622_skip_cross_slug_rejected(db):
    """STARTED on A must not authorize SKIPPED on B for the same session."""
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="yansi-b",
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=1,
            completedStepCount=3,
            destinationSlug="yansi-a",
        )
    assert exc.value.reason == "started_required"
    types = [r.event_type for r in await list_yansi_experience_events(db, experience_session_id=sid)]
    assert types == [YANSI_EXPERIENCE_STARTED]
    assert (await list_yansi_experience_events(db, experience_session_id=sid))[0].mirror_slug == "yansi-a"


@pytest.mark.asyncio
async def test_phase622_skip_cross_version_rejected(db):
    """STARTED on A v1 must not authorize SKIPPED on A v2 for the same session."""
    sid = str(uuid.uuid4())
    await _start(db, sid)
    with pytest.raises(YansiExperienceIngestError) as exc:
        await _ingest(
            db,
            slug="yansi-a",
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_SKIPPED,
            journeyVersion=2,
            completedStepCount=3,
            destinationSlug="yansi-b",
        )
    assert exc.value.reason == "started_required"
    rows = await list_yansi_experience_events(db, experience_session_id=sid)
    assert len(rows) == 1
    assert rows[0].journey_version == 1
    assert rows[0].event_type == YANSI_EXPERIENCE_STARTED


@pytest.mark.asyncio
async def test_http_contract_duplicate_and_forbid_extra():
    from unittest.mock import AsyncMock, patch

    from fastapi.testclient import TestClient

    from backend.core.utils.dependencies import get_db
    from backend.main import app

    async def _fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = _fake_db
    try:
        with (
            patch(
                "backend.routers.mirror_network.rate_limit_experience_events",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "backend.routers.mirror_network.ingest_yansi_experience_event",
                new=AsyncMock(return_value={"accepted": True, "duplicate": True}),
            ),
        ):
            client = TestClient(app)
            ok = client.post(
                "/api/mirror-network/yansi-a/experience-events",
                json={
                    "eventId": str(uuid.uuid4()),
                    "experienceSessionId": str(uuid.uuid4()),
                    "eventType": YANSI_EXPERIENCE_STARTED,
                    "journeyVersion": 1,
                    "occurredAt": "2026-08-15T08:00:00Z",
                },
            )
            assert ok.status_code == 200
            body = ok.json()
            assert body["accepted"] is True
            assert body["duplicate"] is True

            extra = client.post(
                "/api/mirror-network/yansi-a/experience-events",
                json={
                    "eventId": str(uuid.uuid4()),
                    "experienceSessionId": str(uuid.uuid4()),
                    "eventType": YANSI_EXPERIENCE_STARTED,
                    "journeyVersion": 1,
                    "publicQuestion": "secret",
                },
            )
            assert extra.status_code == 422
    finally:
        app.dependency_overrides.pop(get_db, None)
