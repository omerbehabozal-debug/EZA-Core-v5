# -*- coding: utf-8 -*-
"""Stage 04B — merge V2 Discover eligibility into existing Keşfet feed."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    _to_discover_item,
    discover_card_pin_version,
    load_merged_discover_eligible_nodes,
    list_discover_mirrors,
)
from backend.services.yansi.discover_v2 import (
    is_v2_discover_eligible,
    load_v2_discover_eligible_nodes,
    v2_discover_publication_version,
)


def _v1_node(slug: str, *, published_ts: float = 10.0):
    ts = datetime.fromtimestamp(published_ts, tz=timezone.utc)
    return SimpleNamespace(
        id=uuid.uuid4(),
        slug=slug,
        parent_slug=None,
        visibility="public",
        safety_status="open",
        scene_image_url=f"https://cdn.example/{slug}.png",
        public_payload={"publicTitle": slug},
        private_payload={},
        card_title=slug,
        published_at=ts,
        created_at=ts,
        journey_version=1,
        artifact_kind="journey_v1",
        freeze_status="frozen",
        current_v2_publication_version=None,
        user_id=None,
    )


def _v2_node(
    slug: str,
    *,
    scene: str | None,
    content_kind: str = "conversation",
    publication_version: int = 2,
    published: bool = True,
    curiosity: str = "Fırın neden şafakta açılır?",
    published_ts: float = 20.0,
):
    ts = datetime.fromtimestamp(published_ts, tz=timezone.utc) if published else None
    return SimpleNamespace(
        id=uuid.uuid4(),
        slug=slug,
        parent_slug=None,
        visibility="public",
        safety_status="open",
        scene_image_url=scene,
        public_payload={
            "yansiV2": True,
            "contentKind": content_kind,
            "publicationVersion": publication_version,
            "curiosityQuestion": curiosity,
        },
        private_payload={},
        card_title="İtalya sabah fırını",
        published_at=ts,
        created_at=ts,
        journey_version=1,  # intentionally stale — must not be used for V2 pin
        artifact_kind="legacy_landing",
        freeze_status="non_frozen",
        current_v2_publication_version=publication_version,
        user_id=None,
    )


MEDIA = (
    "/api/business-yansi/public-media/"
    "11111111-1111-1111-1111-111111111111/"
    "22222222-2222-2222-2222-222222222222"
)


@pytest.mark.asyncio
async def test_merged_pool_keeps_v1_and_appends_covered_v2():
    v1 = _v1_node("v1-root")
    v2_ok = _v2_node("v2-covered", scene=MEDIA, publication_version=3)
    v2_nocover = _v2_node("v2-nocover", scene=None, publication_version=1)
    db = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.discover.load_discover_eligible_nodes",
            new=AsyncMock(return_value=[(v1, v1.scene_image_url)]),
        ),
        patch(
            "backend.services.yansi.discover_v2.load_v2_discover_eligible_nodes",
            new=AsyncMock(
                return_value=[(v2_ok, MEDIA)]  # coverless never returned by helper
            ),
        ),
    ):
        merged = await load_merged_discover_eligible_nodes(db)

    slugs = {n.slug for n, _ in merged}
    assert slugs == {"v1-root", "v2-covered"}
    assert "v2-nocover" not in slugs


@pytest.mark.asyncio
async def test_merged_pool_dedupes_by_slug_v1_wins():
    shared = "same-slug"
    v1 = _v1_node(shared)
    v2 = _v2_node(shared, scene=MEDIA, publication_version=9)
    db = AsyncMock()
    with (
        patch(
            "backend.services.mirror_network.discover.load_discover_eligible_nodes",
            new=AsyncMock(return_value=[(v1, v1.scene_image_url)]),
        ),
        patch(
            "backend.services.yansi.discover_v2.load_v2_discover_eligible_nodes",
            new=AsyncMock(return_value=[(v2, MEDIA)]),
        ),
    ):
        merged = await load_merged_discover_eligible_nodes(db)
    assert len(merged) == 1
    assert merged[0][0] is v1
    assert merged[0][1].startswith("https://")


def test_v2_card_maps_publication_version_and_curiosity_not_journey_version():
    node = _v2_node("v2-map", scene=MEDIA, publication_version=5, curiosity="Merak?")
    assert node.journey_version == 1
    assert v2_discover_publication_version(node) == 5
    assert discover_card_pin_version(node) == 5
    item = _to_discover_item(
        node,
        scene_url=MEDIA,
        yansi_count=0,
        journey_version=discover_card_pin_version(node),
    )
    assert item.journeyVersion == 5
    assert item.title == "İtalya sabah fırını"
    assert item.description == "Merak?"
    assert item.sceneImageUrl == MEDIA
    assert item.contentKind == "conversation"
    assert not MEDIA.startswith("http://")
    assert "brand-assets" not in (item.sceneImageUrl or "")


def test_v2_image_content_kind_on_card():
    node = _v2_node(
        "v2-img",
        scene=MEDIA,
        content_kind="image",
        publication_version=1,
        curiosity="",
    )
    node.public_payload.pop("curiosityQuestion", None)
    node.card_title = "Kapak görseli"
    item = _to_discover_item(
        node,
        scene_url=MEDIA,
        yansi_count=0,
        journey_version=1,
    )
    assert item.contentKind == "image"
    assert item.title == "Kapak görseli"


def test_coverless_and_unpublished_not_v2_eligible():
    coverless = _v2_node("no-cover", scene=None)
    unpublished = _v2_node("draft", scene=MEDIA, published=False)
    assert is_v2_discover_eligible(coverless) is False
    assert is_v2_discover_eligible(unpublished) is False


@pytest.mark.asyncio
async def test_list_discover_newest_interleaves_v1_v2_by_published_at():
    older_v1 = _v1_node("older-v1", published_ts=1.0)
    newer_v2 = _v2_node("newer-v2", scene=MEDIA, published_ts=99.0, publication_version=2)
    mid_v1 = _v1_node("mid-v1", published_ts=50.0)
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    )

    async def fake_project(_db, page):
        return [
            _to_discover_item(
                node,
                scene_url=scene,
                yansi_count=0,
                journey_version=discover_card_pin_version(node),
            )
            for node, scene in page
        ]

    with (
        patch(
            "backend.services.mirror_network.discover.load_merged_discover_eligible_nodes",
            new=AsyncMock(
                return_value=[
                    (older_v1, older_v1.scene_image_url),
                    (newer_v2, MEDIA),
                    (mid_v1, mid_v1.scene_image_url),
                ]
            ),
        ),
        patch(
            "backend.services.mirror_network.discover._project_discover_page",
            new=fake_project,
        ),
    ):
        response = await list_discover_mirrors(db, mode="newest", limit=10, offset=0)

    assert [item.slug for item in response.items] == ["newer-v2", "mid-v1", "older-v1"]
    assert response.total == 3
    assert response.items[0].journeyVersion == 2
    assert response.items[0].contentKind == "conversation"


@pytest.mark.asyncio
async def test_list_discover_pagination_no_duplicate_across_pages():
    nodes = [
        (
            _v2_node(f"v2-{i}", scene=MEDIA, publication_version=1, published_ts=100 - i),
            MEDIA,
        )
        for i in range(5)
    ] + [
        (_v1_node(f"v1-{i}", published_ts=50 - i), f"https://cdn.example/v1-{i}.png")
        for i in range(5)
    ]
    db = AsyncMock()

    async def fake_project(_db, page):
        return [
            _to_discover_item(
                node,
                scene_url=scene,
                yansi_count=0,
                journey_version=discover_card_pin_version(node),
            )
            for node, scene in page
        ]

    with (
        patch(
            "backend.services.mirror_network.discover.load_merged_discover_eligible_nodes",
            new=AsyncMock(return_value=nodes),
        ),
        patch(
            "backend.services.mirror_network.discover._project_discover_page",
            new=fake_project,
        ),
    ):
        p0 = await list_discover_mirrors(db, mode="newest", limit=4, offset=0)
        p1 = await list_discover_mirrors(db, mode="newest", limit=4, offset=4)
        p2 = await list_discover_mirrors(db, mode="newest", limit=4, offset=8)

    all_slugs = [i.slug for i in p0.items] + [i.slug for i in p1.items] + [i.slug for i in p2.items]
    assert len(all_slugs) == 10
    assert len(set(all_slugs)) == 10
    assert p0.total == 10


@pytest.mark.asyncio
async def test_v2_business_brand_applied_when_bundle_resolves():
    node = _v2_node("branded", scene=MEDIA, publication_version=1)
    item = _to_discover_item(
        node, scene_url=MEDIA, yansi_count=0, journey_version=1
    )
    brand = {
        "displayName": "Kiln Atölyesi",
        "logoUrl": None,
        "businessId": str(uuid.uuid4()),
        "slug": "kiln",
        "verified": True,
        "official": False,
    }
    db = AsyncMock()
    with (
        patch(
            "backend.services.mirror_network.discover._resolve_v2_business_brand",
            new=AsyncMock(return_value=brand),
        ),
        patch(
            "backend.services.mirror_network.discover._fetch_children_for_parents",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.discover._fetch_katki_counts_for_targets",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.discover._load_discover_authors",
            new=AsyncMock(return_value={}),
        ),
    ):
        items = await discover_mod._project_discover_page(db, [(node, MEDIA)])
    assert items[0].publisherKind == "business"
    assert items[0].authorDisplayName == "Kiln Atölyesi"
    assert items[0].publicHonorific is None


@pytest.mark.asyncio
async def test_v2_without_resolvable_brand_stays_non_business():
    node = _v2_node("no-brand", scene=MEDIA, publication_version=1)
    db = AsyncMock()
    with (
        patch(
            "backend.services.mirror_network.discover._resolve_v2_business_brand",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "backend.services.mirror_network.discover._fetch_children_for_parents",
            new=AsyncMock(return_value=[]),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.discover._fetch_katki_counts_for_targets",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.discover._load_discover_authors",
            new=AsyncMock(return_value={}),
        ),
    ):
        items = await discover_mod._project_discover_page(db, [(node, MEDIA)])
    assert items[0].publisherKind == "user"


@pytest.mark.asyncio
async def test_v1_sql_loader_still_excludes_v2_nodes():
    """Regression lock: V1 loader must not see V2; merge is the only inclusion path."""
    from backend.services.mirror_network.discover import load_discover_eligible_nodes

    v2 = _v2_node("only-v2", scene=MEDIA)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [v2])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
    )
    with patch(
        "backend.services.mirror_network.discover.is_canonical_discover_node_structure",
        return_value=False,
    ):
        pool = await load_discover_eligible_nodes(db)
    assert pool == []


@pytest.mark.asyncio
async def test_load_v2_helper_skips_private_media_paths():
    private_scene = "brand-assets/secret.png"
    node = _v2_node("leak", scene=private_scene)
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [node]))
    )
    with patch(
        "backend.services.yansi.discover_v2.evaluate_mirror_network_safety",
        return_value=SimpleNamespace(passed=True),
    ):
        pool = await load_v2_discover_eligible_nodes(db)
    assert pool == []
