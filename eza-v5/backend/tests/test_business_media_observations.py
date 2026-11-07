"""Observation jobs stay dormant and do not change a Yansı."""
import asyncio
import importlib.util
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_media_observations import BusinessMediaObservationFrame as Frame
from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.brand_library_image_fixtures import distinct_library_png
from backend.tests.test_business_yansi import source
from backend.worker.media_observe import serve

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
_BACKEND = Path(__file__).resolve().parents[1]


def _sha(label: str) -> str:
    return (label * 64)[:64]


def _steps(knowledge, phrase):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _index in range(8)
    ]


class _Asset:
    def __init__(self, asset_id, asset_type, title):
        self.id = asset_id
        self.asset_type = asset_type
        self.title = title
        self.caption = ""
        self.verified_duration = 8_000
        self.verified_timescale = 1000
        self.verified_size_bytes = 200
        self.verified_has_audio = False


def test_migration_follows_cover_jobs_and_the_worker_has_no_provider(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_VISION_MODEL", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    path = _BACKEND / "migrations/versions/add_media_observations_v1.py"
    spec = importlib.util.spec_from_file_location("media_observation_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.revision == "add_media_observations_v1"
    assert migration.down_revision == "add_business_video_cover_jobs_v1"
    assert len(migration.revision) <= 32
    service = (_BACKEND / "services/business_yansi/media_observations.py").read_text(encoding="utf-8").lower()
    worker = (_BACKEND / "worker/media_observe.py").read_text(encoding="utf-8").lower()
    for banned in ("openai", "httpx", "urlopen", "https://"):
        assert banned not in service
        assert banned not in worker
    assert observe.analyzer_ready() is False
    assert observe.enabled() is False


def test_phase_7f_ranking_ignores_observation_fields():
    image = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    video = _Asset("00000000-0000-4000-8000-000000000002", "video", "Zeytinyagi")
    closer = _Asset("00000000-0000-4000-8000-000000000099", "video", "Zeytinyagi hasadi ozeti")
    assert media.select_cover("Zeytinyagi kaydi", "", [image, video]) == str(video.id)
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [image, closer]) == str(closer.id)
    plan = {"coverAssetId": str(image.id), "blocks": [[]], "summary": "Sessiz orman", "tags": ["orman"], "seal": None}
    assert media.media_identity(plan) == {"coverAssetId": str(image.id), "blocks": [[]]}
    assert media.media_seal(plan) == media.media_seal({"coverAssetId": str(image.id), "blocks": [[]]})
    assert observe.content_sha_from_locator("https://cdn.example/cover.png") is None
    assert observe.content_sha_from_locator("http://cdn.example/cover.png") is None
    assert observe.content_sha_from_locator(f"brand-videos/{uuid.uuid4()}/staging/{uuid.uuid4()}.partial") is None


async def test_feature_disabled_leaves_upload_and_drafts_alone(sample, asset_dir, monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Zeytinyagi hasadi", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"disabled"))
    image = await _confirm(sample, knowledge, image)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge, "Zeytinyagi hasadi"),
    )
    await sample.db.refresh(knowledge)
    assert knowledge.content == "Kayit metni secimi icin yeterince aciktir."
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert draft.media_plan["coverMode"] == "automatic"
    assert await observe.observation_count(sample.db, sample.business.id) == 0
    assert await observe.ensure_observation(sample.db, image, sample.editor.id) is None


async def test_duplicate_bytes_stay_inside_one_brand(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    first = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Ilk dosya", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"same"))
    again = await observe.ensure_observation(sample.db, first, sample.editor.id)
    second = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Ayni bayt", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"same"))
    assert again.id == (await observe.ensure_observation(sample.db, second, sample.editor.id)).id
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    assert again.summary is None and again.visible_text is None and again.tags is None
    assert again.status == "queued" and again.attempts == 0 and again.origin == "upload"
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-gozlem", "name": "Baska",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "image", "title": "Ilk dosya", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"same"))
    foreign_job = await observe.ensure_observation(sample.db, foreign, sample.outsider.id)
    assert foreign_job.id != again.id
    assert foreign_job.business_id == other.id
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    assert await observe.observation_count(sample.db, other.id) == 1
    revised = await observe.ensure_observation(sample.db, first, sample.editor.id, profile="visual-v2")
    assert revised.id != again.id and revised.analyzer_profile == "visual-v2"
    remote = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Uzak film", "locator": "https://cdn.example/film.mp4", "public_allowed": True,
    })
    assert await observe.ensure_observation(sample.db, remote, sample.editor.id) is None
    generated = await observe.ensure_observation(
        sample.db, first, sample.editor.id, content_sha256=_sha("ab"), origin="generated",
    )
    assert generated.origin == "generated" and generated.status == "queued" and generated.summary is None
    sample.db.add(Frame(
        id=uuid.uuid4(), observation_id=generated.id, business_id=generated.business_id, timestamp_ms=1500,
    ))
    await sample.db.commit()
    stored = await sample.db.scalar(select(Frame).where(Frame.observation_id == generated.id))
    assert stored.timestamp_ms == 1500 and stored.note is None
    clone = Observation(
        id=uuid.uuid4(), business_id=again.business_id, asset_id=again.asset_id,
        content_sha256=again.content_sha256, analyzer_profile=again.analyzer_profile,
        idempotency_key=again.idempotency_key, status="queued", attempts=0, max_attempts=3,
        origin="upload", created_by=again.created_by,
    )
    with pytest.raises(IntegrityError):
        async with sample.db.begin_nested():
            sample.db.add(clone)
            await sample.db.flush()


async def test_claim_is_single_use_and_a_wrong_token_writes_nothing(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'observe.db').as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[Observation.__table__]))
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def plant():
        async with maker() as db:
            db.add(Observation(
                id=uuid.uuid4(), business_id=uuid.uuid4(), asset_id=uuid.uuid4(),
                content_sha256=_sha("c"), analyzer_profile=observe.PROFILE,
                idempotency_key=_sha("d"), status="queued", attempts=0, max_attempts=3,
                origin="upload", created_by=uuid.uuid4(),
            ))
            await db.commit()

    await plant()

    async def take():
        async with maker() as db:
            job = await observe.claim_next(db)
            await db.commit()
            return None if job is None else (job.id, job.claim_token)

    first, second = await asyncio.gather(take(), take())
    assert (first is None) ^ (second is None)
    held = first or second
    async with maker() as db:
        row = await db.get(Observation, held[0])
        assert row.status == "running" and row.attempts == 1 and row.claim_token == held[1]
        deadline = row.deadline_at if row.deadline_at.tzinfo else row.deadline_at.replace(tzinfo=timezone.utc)
        assert deadline > datetime.now(timezone.utc)
        forged = Observation(id=row.id, claim_token="o" + "0" * 32, status="running")
        assert await observe.retain_claim(db, forged) is None
        await db.refresh(row)
        assert row.claim_token == held[1] and row.status == "running"
        row.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await db.commit()
        assert await observe.recover_stale(db) == 1
        await db.commit()
        await db.refresh(row)
        assert row.status == "queued" and row.claim_token is None and row.attempts == 1
        row.status = "running"
        row.attempts = row.max_attempts
        row.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        row.claim_token = "o" + "a" * 32
        await db.commit()
        assert await observe.recover_stale(db) == 0
        await db.commit()
        await db.refresh(row)
        assert row.status == "failed" and row.error_code == "observation_job_stale"
    await engine.dispose()


async def test_worker_recovers_a_crashed_claim_and_does_not_start_one(tmp_path, monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_VISION_MODEL", raising=False)
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'worker.db').as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[Observation.__table__]))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    queued_id = uuid.uuid4()
    crashed_id = uuid.uuid4()
    async with maker() as db:
        db.add(Observation(
            id=queued_id, business_id=uuid.uuid4(), asset_id=uuid.uuid4(),
            content_sha256=_sha("e"), analyzer_profile=observe.PROFILE, idempotency_key=_sha("f"),
            status="queued", attempts=0, max_attempts=3, origin="upload", created_by=uuid.uuid4(),
        ))
        db.add(Observation(
            id=crashed_id, business_id=uuid.uuid4(), asset_id=uuid.uuid4(),
            content_sha256=_sha("1"), analyzer_profile=observe.PROFILE, idempotency_key=_sha("2"),
            status="running", attempts=1, max_attempts=3, origin="upload", created_by=uuid.uuid4(),
            claim_token="o" + "b" * 32, deadline_at=datetime.now(timezone.utc) - timedelta(seconds=5),
        ))
        await db.commit()
    stop = asyncio.Event()

    @asynccontextmanager
    async def once():
        async with maker() as db:
            yield db
        stop.set()

    await serve(once, stop=stop)
    async with maker() as db:
        queued = await db.get(Observation, queued_id)
        crashed = await db.get(Observation, crashed_id)
        assert queued.status == "queued" and queued.attempts == 0 and queued.claim_token is None
        assert crashed.status == "queued" and crashed.claim_token is None and crashed.attempts == 1
        assert queued.summary is None and crashed.summary is None
    await engine.dispose()


async def test_missing_table_still_saves_the_asset(tmp_path, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'bare.db').as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[BusinessBrandAsset.__table__]))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    asset_id = uuid.uuid4()
    async with maker() as db:
        asset = BusinessBrandAsset(
            id=asset_id, business_id=uuid.uuid4(), asset_type="image", title="Dosya",
            locator_kind="storage", locator=f"brand-assets/{uuid.uuid4()}/{_sha('9')}.png",
            public_allowed=True, status="published", created_by=uuid.uuid4(), revision=1,
        )
        db.add(asset)
        await db.flush()
        assert await observe.ensure_observation(db, asset, asset.created_by) is None
        await db.commit()
    async with maker() as db:
        assert await db.get(BusinessBrandAsset, asset_id) is not None
    await engine.dispose()


async def test_ready_observation_does_not_change_cover_selection_or_seals(sample, asset_dir, monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    olive = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Zeytinyagi hasadi", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"olive"))
    other = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Sessiz orman", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"forest"))
    olive = await _confirm(sample, knowledge, olive)
    other = await _confirm(sample, knowledge, other)
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    automatic = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
        cover_asset_id=other.id,
    )
    assert automatic.media_plan["coverAssetId"] == str(olive.id)
    assert explicit.media_plan["coverMode"] == "explicit" and explicit.media_plan["coverAssetId"] == str(other.id)
    sample.db.add(Observation(
        id=uuid.uuid4(), business_id=sample.business.id, asset_id=other.id,
        content_sha256=_sha("4"), analyzer_profile=observe.PROFILE, idempotency_key=_sha("5"),
        status="ready", attempts=0, max_attempts=3, origin="upload", created_by=sample.editor.id,
        summary="Zeytinyagi hasadi ozeti", tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    later = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert later.media_plan["coverAssetId"] == str(olive.id) and later.media_plan["coverMode"] == "automatic"
    await sample.db.refresh(explicit)
    assert explicit.media_plan["coverAssetId"] == str(other.id) and explicit.revision == 1
    for state in ("review", "approved"):
        actor = sample.editor.id if state == "review" else sample.owner.id
        automatic = await svc.transition_draft(
            sample.db, sample.business.id, actor, automatic.id, state, automatic.revision,
        )
    sealed = automatic.media_plan["seal"]
    assert sealed == media.media_seal(automatic.media_plan)
    assert "coverMode" not in automatic.media_plan
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    await observe.ensure_observation(sample.db, olive, sample.editor.id)
    await sample.db.commit()
    await sample.db.refresh(automatic)
    await sample.db.refresh(explicit)
    assert automatic.status == "approved"
    assert automatic.media_plan["seal"] == sealed
    assert automatic.media_plan["coverAssetId"] == str(olive.id)
    assert explicit.media_plan["coverAssetId"] == str(other.id)
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, automatic.id)
    await sample.db.refresh(automatic)
    conversation = await sample.db.get(StandaloneConversation, automatic.conversation_id)
    sample.db.add(MirrorNetworkNode(
        slug="zeytin-gozlem", user_id=automatic.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Zeytinyagi", card_date="2026-11-01",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    ))
    await sample.db.commit()
    await sample.db.refresh(automatic)

    def matching(_internal):
        return {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]}

    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        matching,
    )
    await publish_draft(sample.db, sample.business.id, sample.owner.id, automatic.id, "zeytin-gozlem", automatic.revision)
    published = await sample.db.get(BusinessPublication, ("zeytin-gozlem", 1))
    assert published.media_plan["seal"] == sealed
    assert published.media_plan["coverAssetId"] == str(olive.id)
    await sample.db.refresh(automatic)
    assert automatic.media_plan["seal"] == sealed
