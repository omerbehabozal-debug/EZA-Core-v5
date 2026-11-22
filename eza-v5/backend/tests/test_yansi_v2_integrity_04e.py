"""Stage 04E — publication version pin + experience ingest integrity."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import Base
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.yansi_experience_events import (
    YansiExperienceIngestError,
    ingest_yansi_experience_event,
)
from backend.services.yansi.continuation_v2 import bind_yansi_v2_history
from backend.services.yansi.publish_image_v2 import publish_single_image_grounded_v2
from backend.tests.test_business_yansi import sample  # noqa: F401
from backend.tests.test_yansi_v2_publish_image import _ensure_v2_tables, _image_asset


async def _ensure_experience_table(db: AsyncSession):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[YansiExperienceEvent.__table__],
        )

    await db.run_sync(create)


@pytest.mark.asyncio
async def test_bind_rejects_missing_publication_version(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"pin-{uuid.uuid4().hex[:8]}"
    published = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Pin",
        description="Kiln fires at dawn.",
        slug=slug,
        expected_current_version=None,
        idempotency_key=f"pin-{slug}",
    )
    assert published["publicationVersion"] == 1

    assert await bind_yansi_v2_history(sample.db, slug, None, []) is None
    assert await bind_yansi_v2_history(sample.db, slug, 0, []) is None

    bound = await bind_yansi_v2_history(sample.db, slug, 1, [])
    assert bound is not None
    assert bound.publication_version == 1


@pytest.mark.asyncio
async def test_experience_ingest_accepts_v2_image_publication_version(sample):
    await _ensure_v2_tables(sample.db)
    await _ensure_experience_table(sample.db)
    asset = await _image_asset(sample)
    slug = f"exp-{uuid.uuid4().hex[:8]}"
    published = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Experience",
        description="Kiln fires at dawn.",
        slug=slug,
        expected_current_version=None,
        idempotency_key=f"exp-{slug}",
    )
    version = published["publicationVersion"]
    session_id = str(uuid.uuid4())

    started = await ingest_yansi_experience_event(
        sample.db,
        slug=slug,
        payload={
            "eventId": str(uuid.uuid4()),
            "eventType": YANSI_EXPERIENCE_STARTED,
            "experienceSessionId": session_id,
            "journeyVersion": version,
            "completedStepCount": 0,
            "occurredAt": "2026-11-21T12:00:00Z",
        },
        viewer_user_id=None,
    )
    assert started == {"accepted": True, "duplicate": False}

    completed = await ingest_yansi_experience_event(
        sample.db,
        slug=slug,
        payload={
            "eventId": str(uuid.uuid4()),
            "eventType": YANSI_EXPERIENCE_COMPLETED,
            "experienceSessionId": session_id,
            "journeyVersion": version,
            "completedStepCount": 0,
            "occurredAt": "2026-11-21T12:01:00Z",
        },
        viewer_user_id=None,
    )
    assert completed == {"accepted": True, "duplicate": False}

    with pytest.raises(YansiExperienceIngestError):
        await ingest_yansi_experience_event(
            sample.db,
            slug=slug,
            payload={
                "eventId": str(uuid.uuid4()),
                "eventType": YANSI_EXPERIENCE_STARTED,
                "experienceSessionId": str(uuid.uuid4()),
                "journeyVersion": 99,
                "completedStepCount": 0,
                "occurredAt": "2026-11-21T12:02:00Z",
            },
            viewer_user_id=None,
        )
