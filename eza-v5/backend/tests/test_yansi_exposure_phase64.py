# -*- coding: utf-8 -*-
"""Phase 6.4 — durable exposure ingest + visibility contract."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401

from backend.models.yansi_exposure_event import YansiExposureEvent
from backend.services.mirror_network.yansi_exposure import (
    YansiExposureIngestError,
    count_exposures_by_context,
    ingest_yansi_exposure_event,
)


def _artifact(slug: str, version: int = 1):
    return {
        "slug": slug,
        "journeyVersion": version,
        "selectedCount": 8,
        "replayReady": True,
        "artifactKind": "journey_v1",
    }


ARTIFACTS = {
    ("yansi-a", 1): _artifact("yansi-a", 1),
    ("yansi-a", 2): _artifact("yansi-a", 2),
}


async def _lookup(_db, *, slug: str, journey_version: int | None = None):
    key = ((slug or "").strip().lower(), int(journey_version or 0))
    return ARTIFACTS.get(key)


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiExposureEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


async def _ingest(db, **payload):
    slug = payload.pop("slug", "yansi-a")
    with patch(
        "backend.services.mirror_network.yansi_exposure.get_public_frozen_journey_artifact",
        new=_lookup,
    ):
        return await ingest_yansi_exposure_event(db, slug=slug, payload=payload)


@pytest.mark.asyncio
async def test_valid_exposure_accepted_once(db):
    sid, eid = str(uuid.uuid4()), str(uuid.uuid4())
    first = await _ingest(
        db,
        eventId=eid,
        exposureSessionId=sid,
        journeyVersion=1,
        context="discover",
    )
    second = await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        exposureSessionId=sid,
        journeyVersion=1,
        context="discover",
    )
    assert first == {"accepted": True, "duplicate": False}
    assert second == {"accepted": True, "duplicate": True}
    counts = await count_exposures_by_context(db, slug="yansi-a", journey_version=1)
    assert counts["discover"] == 1
    assert counts["landing"] == 0


@pytest.mark.asyncio
async def test_same_session_other_context_is_separate_unit(db):
    sid = str(uuid.uuid4())
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        exposureSessionId=sid,
        journeyVersion=1,
        context="discover",
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        exposureSessionId=sid,
        journeyVersion=1,
        context="landing",
    )
    counts = await count_exposures_by_context(db, slug="yansi-a", journey_version=1)
    assert counts["discover"] == 1
    assert counts["landing"] == 1


@pytest.mark.asyncio
async def test_version_scopes_exposure(db):
    sid = str(uuid.uuid4())
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        exposureSessionId=sid,
        journeyVersion=1,
        context="discover",
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        exposureSessionId=sid,
        journeyVersion=2,
        context="discover",
    )
    v1 = await count_exposures_by_context(db, slug="yansi-a", journey_version=1)
    v2 = await count_exposures_by_context(db, slug="yansi-a", journey_version=2)
    assert v1["discover"] == 1
    assert v2["discover"] == 1


@pytest.mark.asyncio
async def test_privacy_rejected_and_no_content_columns():
    cols = {c.name.lower() for c in YansiExposureEvent.__table__.columns}
    for needle in (
        "public_question",
        "eza_snapshot",
        "relationship_map",
        "ip",
        "user_agent",
        "guest_token",
        "lineage_proof_token",
        "fingerprint",
        "referrer",
        "url",
    ):
        assert needle not in cols
    sid, eid = str(uuid.uuid4()), str(uuid.uuid4())
    with pytest.raises(YansiExposureIngestError) as exc:
        await ingest_yansi_exposure_event(
            None,  # type: ignore[arg-type]
            slug="yansi-a",
            payload={
                "eventId": eid,
                "exposureSessionId": sid,
                "journeyVersion": 1,
                "context": "discover",
                "publicQuestion": "nope",
            },
        )
    assert exc.value.reason == "privacy_rejected"


@pytest.mark.asyncio
async def test_invalid_context_rejected(db):
    with pytest.raises(YansiExposureIngestError) as exc:
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            exposureSessionId=str(uuid.uuid4()),
            journeyVersion=1,
            context="json_fetch",
        )
    assert exc.value.reason == "invalid_context"
