"""Yansı V2 Stage 3A.1 — publish concurrency / race behaviour.

PostgreSQL races run only when BILIGN_YANSI_V2_PG_TEST_URL (or cover retarget URL)
points at localhost disposable Postgres. SQLite covers sequential race gates.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.mirror_network import MirrorNetworkNode, YansiPublicationVersionV2
from backend.models.production import Organization, User
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.services.yansi import publish_image_v2 as pubv2
from backend.services.yansi.publish_image_v2 import (
    ImagePublishV2Error,
    publish_single_image_grounded_v2,
)
from backend.tests.test_business_yansi import sample  # noqa: F401


def _pg_url():
    for name in (
        "BILIGN_YANSI_V2_PG_TEST_URL",
        "BILIGN_COVER_RETARGET_TEST_URL",
        "BUSINESS_STUDIO_TEST_POSTGRES_URL",
    ):
        raw = os.getenv(name, "").strip()
        if raw:
            break
    else:
        return None
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        return None
    url = make_url(raw)
    if url.host not in {"127.0.0.1", "localhost", "::1"}:
        return None
    return raw


async def _ensure_tables(db: AsyncSession):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[
                YansiKnowledgeBundle.__table__,
                YansiKnowledgeBundleVersion.__table__,
                YansiPublicationVersionV2.__table__,
            ],
        )
    await db.run_sync(create)


async def _asset(sample, revision=1):
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="Race",
        locator_kind="storage",
        locator=f"brand-assets/{sample.business.id}/{uuid.uuid4().hex}.png",
        public_allowed=True,
        status="published",
        created_by=sample.owner.id,
        approved_by=sample.owner.id,
        revision=revision,
    )
    sample.db.add(asset)
    await sample.db.commit()
    await sample.db.refresh(asset)
    return asset


@pytest.mark.asyncio
async def test_sqlite_asset_revision_change_mid_publish(sample, monkeypatch):
    """Second asset lock sees bumped revision → revision_conflict (fail-closed)."""
    await _ensure_tables(sample.db)
    asset = await _asset(sample, revision=1)
    calls = {"n": 0}
    original = pubv2._load_asset_for_update

    async def flaky(db, asset_id):
        row = await original(db, asset_id)
        calls["n"] += 1
        if calls["n"] >= 2 and row is not None:
            row.revision = 99
        return row

    monkeypatch.setattr(pubv2, "_load_asset_for_update", flaky)
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Mid flight",
            slug=f"mid-{uuid.uuid4().hex[:8]}",
            expected_current_version=None,
        )
    assert raised.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_sqlite_digest_change_mid_publish(sample, monkeypatch):
    await _ensure_tables(sample.db)
    asset = await _asset(sample, revision=1)
    original = pubv2._load_asset_for_update
    calls = {"n": 0}

    async def flaky(db, asset_id):
        row = await original(db, asset_id)
        calls["n"] += 1
        if calls["n"] >= 2 and row is not None:
            row.locator = f"brand-assets/{sample.business.id}/{'a' * 64}.png"
        return row

    monkeypatch.setattr(pubv2, "_load_asset_for_update", flaky)
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Digest race",
            slug=f"dig-{uuid.uuid4().hex[:8]}",
            expected_current_version=None,
        )
    assert raised.value.code == "bundle_digest_mismatch"


@pytest.mark.asyncio
async def test_sqlite_node_pointer_stale_rejected(sample):
    await _ensure_tables(sample.db)
    asset = await _asset(sample)
    first = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="First",
        slug=f"ptr-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Stale",
            node_id=first["nodeId"],
            expected_current_version=0,  # wrong token
        )
    assert raised.value.code == "revision_conflict"


def _allow_text_vector_without_pgvector():
    from sqlalchemy.ext.compiler import compiles

    from backend.models.business_yansi import Vector1536

    @compiles(Vector1536, "postgresql")
    def _pg_vector_as_text(type_, compiler, **kw):  # noqa: ARG001
        return "TEXT"


@asynccontextmanager
async def _pg_sessions():
    url = _pg_url()
    if url is None:
        pytest.skip(
            "BLOCKED: izole PostgreSQL kimlik bilgisi yok — "
            "BILIGN_YANSI_V2_PG_TEST_URL ayarlanmadı; eşzamanlı PG yarışları çalıştırılmadı."
        )
    _allow_text_vector_without_pgvector()
    schema = "yansi_race_" + uuid.uuid4().hex[:10]
    engine = create_async_engine(
        url,
        connect_args={"server_settings": {"search_path": schema}},
        pool_size=5,
    )
    async with engine.begin() as conn:
        await conn.execute(CreateSchema(schema))
        await conn.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    User.__table__,
                    Organization.__table__,
                    BusinessProfile.__table__,
                    BusinessMember.__table__,
                    BusinessBrandAsset.__table__,
                    MirrorNetworkNode.__table__,
                    YansiKnowledgeBundle.__table__,
                    YansiKnowledgeBundleVersion.__table__,
                    YansiPublicationVersionV2.__table__,
                ],
            )
        )
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as setup:
            owner = User(id=uuid.uuid4(), email=f"r-{uuid.uuid4().hex}@t.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="Race", status="active")
            biz = BusinessProfile(
                id=org.id, slug=f"r-{uuid.uuid4().hex[:6]}", name="Race",
                owner_id=owner.id, status="active",
            )
            member = BusinessMember(business_id=org.id, user_id=owner.id, role="owner")
            asset = BusinessBrandAsset(
                id=uuid.uuid4(), business_id=org.id, asset_type="image", title="Race",
                locator_kind="storage",
                locator=f"brand-assets/{org.id}/{uuid.uuid4().hex}.png",
                public_allowed=True, status="published",
                created_by=owner.id, approved_by=owner.id, revision=1,
            )
            setup.add_all([owner, org])
            await setup.flush()
            setup.add(biz)
            await setup.flush()
            setup.add_all([member, asset])
            await setup.commit()
            ctx = SimpleNamespace(
                Session=Session,
                owner=owner,
                business=biz,
                asset=asset,
            )
        yield ctx
    finally:
        async with engine.begin() as conn:
            await conn.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_concurrent_same_idempotency_key():
    async with _pg_sessions() as ctx:
        slug = f"idem-{uuid.uuid4().hex[:8]}"

        # Pre-create node so both workers lock the same row.
        async with ctx.Session() as db:
            node = MirrorNetworkNode(
                id=uuid.uuid4(),
                slug=slug,
                user_id=ctx.owner.id,
                visibility="private",
                safety_status="open",
                card_title="Race",
                card_date="2026-11-20",
                public_payload={"yansiV2": True},
                private_payload={},
                artifact_kind="legacy_landing",
                journey_version=1,
                freeze_status="non_frozen",
                current_v2_publication_version=None,
            )
            db.add(node)
            await db.commit()
            node_id = str(node.id)

        async def worker(key_suffix=""):
            async with ctx.Session() as db:
                return await publish_single_image_grounded_v2(
                    db,
                    business_id=str(ctx.business.id),
                    actor_user_id=str(ctx.owner.id),
                    asset_id=str(ctx.asset.id),
                    expected_asset_revision=1,
                    title="Concurrent idem",
                    node_id=node_id,
                    expected_current_version=None,
                    idempotency_key="same-key",
                )

        results = await asyncio.gather(worker(), worker(), return_exceptions=True)
        oks = [r for r in results if isinstance(r, dict)]
        errs = [r for r in results if isinstance(r, BaseException)]
        assert len(oks) == 2, f"expected both to resolve, got oks={oks} errs={errs}"
        assert {r["publicationVersion"] for r in oks} == {1}
        assert oks[0]["contractHash"] == oks[1]["contractHash"]
        assert any(r["idempotent"] for r in oks)
        async with ctx.Session() as db:
            count = len(
                (
                    await db.scalars(
                        select(YansiPublicationVersionV2).where(
                            YansiPublicationVersionV2.node_id == uuid.UUID(node_id)
                        )
                    )
                ).all()
            )
        assert count == 1


@pytest.mark.asyncio
async def test_postgres_concurrent_different_keys_one_wins():
    async with _pg_sessions() as ctx:
        slug = f"diff-{uuid.uuid4().hex[:8]}"
        async with ctx.Session() as db:
            node = MirrorNetworkNode(
                id=uuid.uuid4(),
                slug=slug,
                user_id=ctx.owner.id,
                visibility="private",
                safety_status="open",
                card_title="Race",
                card_date="2026-11-20",
                public_payload={"yansiV2": True},
                private_payload={},
                artifact_kind="legacy_landing",
                journey_version=1,
                freeze_status="non_frozen",
                current_v2_publication_version=None,
            )
            db.add(node)
            await db.commit()
            node_id = str(node.id)

        async def worker(key):
            async with ctx.Session() as db:
                return await publish_single_image_grounded_v2(
                    db,
                    business_id=str(ctx.business.id),
                    actor_user_id=str(ctx.owner.id),
                    asset_id=str(ctx.asset.id),
                    expected_asset_revision=1,
                    title="Concurrent diff",
                    node_id=node_id,
                    expected_current_version=None,
                    idempotency_key=key,
                )

        results = await asyncio.gather(worker("k1"), worker("k2"), return_exceptions=True)
        oks = [r for r in results if isinstance(r, dict)]
        errs = [r for r in results if isinstance(r, ImagePublishV2Error)]
        assert len(oks) == 1
        assert len(errs) == 1
        assert errs[0].code in {"duplicate_publish", "revision_conflict"}
        async with ctx.Session() as db:
            count = len(
                (
                    await db.scalars(
                        select(YansiPublicationVersionV2).where(
                            YansiPublicationVersionV2.node_id == uuid.UUID(node_id)
                        )
                    )
                ).all()
            )
        assert count == 1
