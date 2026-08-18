# -*- coding: utf-8 -*-
"""Phase 7.4.3a — staging corpus seed (CI sqlite / in-memory)."""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

# Shared Base mapper registry — required before sqlite User queries.
from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401
from backend.models.api_key import APIKey  # noqa: F401
from backend.models.application import Application  # noqa: F401

from backend.models.mirror_network import MirrorJourneyStep, MirrorNetworkNode
from backend.models.production import User
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.models.yansi_exposure_event import YansiExposureEvent
from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import list_discover_mirrors, load_discover_eligible_roots
from backend.services.mirror_network.yansi_metrics import get_yansi_public_metrics
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import POLICY_VERSION
from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
    EVALUATOR_VERSION,
    evaluate_production_corpus_shadow,
)
from backend.services.mirror_network import yansi_strong_curiosity_staging_seed as seed_mod
from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import (
    AUTHOR_HANDLES,
    EMAIL_DOMAIN,
    SCENE_URL,
    SEED_BATCH_ID,
    SLUG_PREFIX,
    StagingSeedError,
    assert_seed_environment,
    build_staging_seed_plan,
    cleanup_staging_corpus,
    persist_staging_corpus,
)
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    evaluate_strong_curiosity_candidates_batch,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
TEST_SETTINGS = SimpleNamespace(ENV="test", EZA_ENV=None)


@compiles(PGUUID, "sqlite")
def _compile_pg_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"


async def _tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(User.__table__.create)
        await conn.run_sync(MirrorNetworkNode.__table__.create)
        await conn.run_sync(MirrorJourneyStep.__table__.create)
        await conn.run_sync(YansiExperienceEvent.__table__.create)
        await conn.run_sync(YansiExposureEvent.__table__.create)
        await conn.run_sync(YansiOwnContinuationEvent.__table__.create)


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    await _tables(engine)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


def test_production_env_aborts():
    with pytest.raises(StagingSeedError) as exc:
        assert_seed_environment(SimpleNamespace(ENV="production", EZA_ENV=None))
    assert exc.value.reason == "production_seed_forbidden"
    with pytest.raises(StagingSeedError) as exc2:
        assert_seed_environment(SimpleNamespace(ENV="prod", EZA_ENV=None))
    assert exc2.value.reason == "production_seed_forbidden"


def test_staging_and_dev_envs_allowed():
    assert assert_seed_environment(SimpleNamespace(ENV="staging", EZA_ENV=None)) == "staging"
    assert assert_seed_environment(SimpleNamespace(ENV="test", EZA_ENV=None)) == "test"
    assert assert_seed_environment(SimpleNamespace(ENV="ci", EZA_ENV=None)) == "ci"
    assert assert_seed_environment(SimpleNamespace(ENV="development", EZA_ENV=None)) == "development"
    assert assert_seed_environment(SimpleNamespace(ENV="dev", EZA_ENV=None)) == "dev"


def test_deterministic_seed_plan():
    a = build_staging_seed_plan(size="small", seed=SEED_BATCH_ID)
    b = build_staging_seed_plan(size="small", seed=SEED_BATCH_ID)
    assert a["roots"] == b["roots"]
    assert a["rootCount"] == 56
    assert a["intended"]["users"] == len(AUTHOR_HANDLES)


def test_dry_run_does_not_need_db_and_does_not_mutate():
    plan = build_staging_seed_plan(size="small")
    src = inspect.getsource(build_staging_seed_plan)
    assert "db.add" not in src
    assert plan["namespace"] == SLUG_PREFIX
    emails = [f"phase743a+{h}@{EMAIL_DOMAIN}" for h in plan["authorHandles"]]
    assert all(EMAIL_DOMAIN in email for email in emails)
    assert "ezacore.ai" not in str(plan)


@pytest.mark.asyncio
async def test_seed_idempotency_cleanup_eligibility_and_coverage(db: AsyncSession):
    first = await persist_staging_corpus(db, size="small", settings=TEST_SETTINGS, commit=True)
    nodes_1 = (
        await db.execute(
            select(func.count()).select_from(MirrorNetworkNode).where(
                MirrorNetworkNode.slug.like(f"{SLUG_PREFIX}%")
            )
        )
    ).scalar()
    events_1 = (
        await db.execute(
            select(func.count()).select_from(YansiExperienceEvent).where(
                YansiExperienceEvent.mirror_slug.like(f"{SLUG_PREFIX}%")
            )
        )
    ).scalar()
    second = await persist_staging_corpus(db, size="small", settings=TEST_SETTINGS, commit=True)
    nodes_2 = (
        await db.execute(
            select(func.count()).select_from(MirrorNetworkNode).where(
                MirrorNetworkNode.slug.like(f"{SLUG_PREFIX}%")
            )
        )
    ).scalar()
    events_2 = (
        await db.execute(
            select(func.count()).select_from(YansiExperienceEvent).where(
                YansiExperienceEvent.mirror_slug.like(f"{SLUG_PREFIX}%")
            )
        )
    ).scalar()
    assert nodes_1 == nodes_2
    assert events_1 == events_2
    assert first["validation"]["eligibleRoots"] == second["validation"]["eligibleRoots"]
    assert first["validation"]["candidatePool"] >= 20
    assert first["validation"]["distinctAuthors"] >= 8
    assert first["validation"]["externalGenerativityCandidates"] >= 5
    assert first["validation"]["historicalOnly"] >= 2
    assert first["validation"]["lowSample"] >= 2
    assert first["validation"]["selfPlay"] >= 1
    assert first["validation"]["authConcentrated"] >= 1

    with patch(
        "backend.services.mirror_network.yansi_strong_curiosity_live.is_strong_curiosity_discover_enabled",
        return_value=False,
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False
    random_list = await list_discover_mirrors(
        db, mode="random", limit=10, random_session="phase743a-session"
    )
    assert len(random_list.items) >= 1
    newest = await list_discover_mirrors(db, mode="newest", limit=10)
    assert len(newest.items) >= 1

    eligible = await load_discover_eligible_roots(db)
    assert len(eligible) >= 50
    for node, scene in eligible:
        assert node.parent_slug is None
        assert node.visibility == "public"
        assert node.safety_status == "open"
        assert node.freeze_status == "frozen"
        assert node.artifact_kind == "journey_v1"
        assert node.published_at is not None
        assert scene.startswith("https://")
        steps = (
            await db.execute(
                select(MirrorJourneyStep).where(MirrorJourneyStep.journey_slug == node.slug)
            )
        ).scalars().all()
        assert len(steps) in (6, 7, 8)

    pairs = [
        (node.slug, int(getattr(node, "journey_version", None) or 1)) for node, _ in eligible
    ]
    profiles = await evaluate_strong_curiosity_candidates_batch(
        db, pairs, discover_eligible=set(pairs), evaluated_at=NOW
    )
    report = evaluate_production_corpus_shadow(
        profiles,
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=len(eligible),
        evaluated_eligible_count=len(eligible),
        author_by_slug={
            node.slug: str(node.user_id) for node, _ in eligible
        },
        real_corpus_run=True,
    )
    assert report["corpus"]["evaluatedEligibleCount"] >= 50
    assert report["corpus"]["candidatePoolCount"] >= 20

    guests = (
        await db.execute(
            select(func.count()).select_from(YansiExperienceEvent).where(
                YansiExperienceEvent.event_type == YANSI_EXPERIENCE_STARTED,
                YansiExperienceEvent.viewer_user_id.is_(None),
                YansiExperienceEvent.mirror_slug.like(f"{SLUG_PREFIX}%"),
            )
        )
    ).scalar()
    assert guests and guests > 0
    event_src = inspect.getsource(seed_mod._replace_events)
    assert "user_agent" not in event_src
    assert "userAgent" not in event_src
    assert "fingerprint" not in event_src
    assert "ip_address" not in event_src
    assert "raw_ip" not in event_src

    assert first["plan"]["archetypeCounts"]["historical"] >= 2
    assert first["plan"]["archetypeCounts"]["self_play"] >= 2
    assert first["plan"]["archetypeCounts"]["guest_heavy"] >= 2
    assert first["plan"]["archetypeCounts"]["multi_author_network"] >= 2

    network_root = next(
        row for row in build_staging_seed_plan(size="small")["roots"] if row["grandchild"]
    )
    metrics = await get_yansi_public_metrics(
        db, slug=network_root["slug"], journey_version=network_root["version"]
    )
    assert metrics["directChildYansiCount"] == len(network_root["child_slugs"])
    assert metrics["experienceStartedCount"] == (
        network_root["author_self_starts"]
        + network_root["guest_starts"]
        + network_root["external_starts"]
    )
    grandchild = (
        await db.execute(
            select(MirrorNetworkNode).where(MirrorNetworkNode.slug == network_root["grandchild_slug"])
        )
    ).scalar_one()
    assert grandchild.parent_slug == network_root["child_slugs"][0]

    plan_roots = build_staging_seed_plan(size="small")["roots"]
    ages = {row["age_days"] for row in plan_roots}
    assert ages.intersection({2, 3, 14, 45, 180, 420})
    for wanted in (6, 7, 8):
        spec = next(row for row in plan_roots if row["selected_count"] == wanted)
        n = len(
            (
                await db.execute(
                    select(MirrorJourneyStep).where(MirrorJourneyStep.journey_slug == spec["slug"])
                )
            ).scalars().all()
        )
        assert n == wanted

    users = (
        await db.execute(select(User).where(User.email.like(f"phase743a+%@{EMAIL_DOMAIN}")))
    ).scalars().all()
    assert len(users) >= 8
    assert all("@fixtures.bilign.test" in u.email for u in users)
    assert SCENE_URL.startswith("https://")
    src = inspect.getsource(seed_mod)
    assert "assistantScore" not in src
    assert "relationshipMap" not in src
    assert "postgresql://" not in src
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"

    extra = User(
        email="keep-me@example.test",
        password_hash="x",
        role="user",
        is_active=True,
        created_at=NOW,
    )
    db.add(extra)
    await db.commit()
    removed = await cleanup_staging_corpus(db, commit=True)
    assert removed["nodes"] >= 50
    leftover = (
        await db.execute(
            select(func.count()).select_from(MirrorNetworkNode).where(
                MirrorNetworkNode.slug.like(f"{SLUG_PREFIX}%")
            )
        )
    ).scalar()
    assert leftover == 0
    keeper = (
        await db.execute(select(User).where(User.email == "keep-me@example.test"))
    ).scalar_one()
    assert keeper is not None


def test_live_discover_does_not_import_seed():
    src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    router_src = inspect.getsource(mirror_router)
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "seed_strong_curiosity_staging_corpus" not in list_src
    assert "yansi_strong_curiosity_staging_seed" not in router_src
    assert "yansi_strong_curiosity_author_concentration_diagnosis" not in src
    assert "yansi_strong_curiosity_author_concentration_diagnosis" not in router_src


def test_phase742_and_743_versions_unchanged():
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert EVALUATOR_VERSION == "strong_curiosity_production_shadow_v743"
    seed_src = inspect.getsource(seed_mod.persist_staging_corpus)
    assert "representation_band" not in seed_src
    assert "order_final_shadow_candidates" not in seed_src
    cli = (
        Path(__file__).resolve().parents[1]
        / "scripts"
        / "seed_strong_curiosity_staging_corpus.py"
    ).read_text(encoding="utf-8")
    assert "--force-production" not in cli
    assert "postgresql://" not in cli
    cleanup_src = inspect.getsource(seed_mod.cleanup_staging_corpus)
    assert "delete(MirrorNetworkNode)" in cleanup_src
    assert "slug.like" in cleanup_src
    assert "delete(MirrorNetworkNode)" != cleanup_src.strip()
