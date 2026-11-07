# -*- coding: utf-8 -*-
"""Library assets may omit titles (image/video/place/link)."""

from __future__ import annotations

from decimal import Decimal

from backend.services.business_yansi.brand_assets import normalize_asset


def test_normalize_allows_empty_titles_for_all_library_types():
    biz = "11111111-1111-4111-8111-111111111111"
    digest = "a" * 64
    image = normalize_asset(
        business_id=biz,
        asset_type="image",
        title="",
        locator_kind="storage",
        locator=f"brand-assets/{biz}/{digest}.jpg",
    )
    assert image["title"] == ""

    video = normalize_asset(
        business_id=biz,
        asset_type="video",
        title="",
        locator_kind="storage",
        locator=f"brand-videos/{biz}/{digest}.mp4",
    )
    assert video["title"] == ""

    place = normalize_asset(
        business_id=biz,
        asset_type="place",
        title="",
        caption="Karakoy",
        latitude="41.025",
        longitude="28.974",
    )
    assert place["title"] == ""
    assert place["latitude"] == Decimal("41.025000")

    link = normalize_asset(
        business_id=biz,
        asset_type="link",
        title="",
        locator="https://example.com/menu",
    )
    assert link["title"] == ""
    assert link["locator"] == "https://example.com/menu"


def test_normalize_still_rejects_oversized_titles():
    from fastapi import HTTPException

    try:
        normalize_asset(
            business_id="11111111-1111-4111-8111-111111111111",
            asset_type="link",
            title="x" * 161,
            locator="https://example.com/menu",
        )
        assert False, "expected rejection"
    except HTTPException as raised:
        assert raised.status_code == 422
        assert raised.detail["code"] == "asset_title_rejected"
