"""Choose brand media for an eight-step Yansı without another model call.

The extractive Studio engine still writes the question and the source passage.
This module only accepts asset ids from the brand catalog confirmed on those
exact knowledge versions. A URL, coordinate, or file path is rejected.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_brand_assets import BusinessKnowledgeAssetLink as Link
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessProfile
from backend.models.production import Organization
from backend.services.business_yansi.brand_assets import public_media_allowed
from backend.services.business_yansi.service import fail, source_hash, uid


BLOCK_TYPES = {"image": "image", "video": "video", "place": "map", "link": "link"}
_FORBIDDEN = {"url", "locator", "latitude", "longitude", "path", "file", "src", "href", "coordinates"}


def empty_plan(count=8):
    return {"coverAssetId": None, "blocks": [[] for _ in range(count)], "seal": None}


def media_identity(plan):
    return {"coverAssetId": plan.get("coverAssetId"), "blocks": plan.get("blocks") or []}


def media_seal(plan):
    return source_hash(media_identity(plan))


def _words(text):
    return set(re.findall(r"[^\W_]{3,}", (text or "").casefold(), re.UNICODE))


def _rank(context, assets):
    words = _words(context)
    scored = []
    for asset in assets:
        score = len(words & _words(f"{asset.title} {asset.caption or ''}"))
        if score:
            scored.append((score, str(asset.id), asset))
    return [row[2] for row in sorted(scored, key=lambda item: (-item[0], item[1]))]


def accept_model_choice(choice, assets):
    """A model may name catalog ids. Anything else is refused."""
    if choice is None:
        return None
    if not isinstance(choice, list):
        fail("asset_choice_rejected", 422)
    catalog = {str(asset.id): asset for asset in assets}
    picked = []
    seen = set()
    for item in choice:
        if not isinstance(item, dict) or set(item) != {"type", "assetId"} or set(item) & _FORBIDDEN:
            fail("asset_choice_rejected", 422)
        asset = catalog.get(str(item.get("assetId") or ""))
        if asset is None or BLOCK_TYPES.get(asset.asset_type) != item.get("type") or item["type"] in seen:
            fail("asset_choice_rejected", 422)
        seen.add(item["type"])
        picked.append({"type": item["type"], "assetId": str(asset.id)})
    return picked


def select_step_blocks(question, answer, assets, choice=None):
    chosen = accept_model_choice(choice, assets)
    if chosen is not None:
        return chosen
    picked = []
    seen = set()
    for asset in _rank(f"{question} {answer}", assets):
        block = BLOCK_TYPES[asset.asset_type]
        if block in seen:
            continue
        seen.add(block)
        picked.append({"type": block, "assetId": str(asset.id)})
    return picked


def select_cover(title, summary, assets):
    images = [asset for asset in assets if asset.asset_type == "image"]
    ranked = _rank(f"{title} {summary}", images)
    return str(ranked[0].id) if ranked else None


def public_media_view(plan, eligible_ids):
    """Live public view. A revoked id is omitted and never replaced."""
    if not plan:
        return {"coverAssetId": None, "blocks": []}
    allowed = {str(item) for item in eligible_ids}
    cover = plan.get("coverAssetId")
    return {
        "coverAssetId": cover if cover in allowed else None,
        "blocks": [[block for block in step if block.get("assetId") in allowed] for step in plan.get("blocks") or []],
    }


def plan_is_live(steps, plan, grouped):
    blocks = plan.get("blocks") or []
    if len(blocks) != len(steps):
        return False
    for step, chosen in zip(steps, blocks):
        allowed = set()
        for source in step["sources"]:
            allowed.update(str(asset.id) for asset in grouped.get(uid(source), []))
        if any(block.get("assetId") not in allowed for block in chosen):
            return False
    cover = plan.get("coverAssetId")
    if not cover:
        return True
    images = {
        str(asset.id)
        for assets in grouped.values()
        for asset in assets
        if asset.asset_type == "image"
    }
    return cover in images


async def eligible_for_versions(db, business_id, version_ids):
    business = uid(business_id)
    ids = [uid(value) for value in version_ids]
    profile = await db.get(BusinessProfile, business)
    organization = await db.get(Organization, business)
    versions = list((await db.scalars(select(Knowledge).where(Knowledge.business_id == business, Knowledge.id.in_(ids)))).all())
    by_id = {row.id: row for row in versions}
    grouped = {row.id: [] for row in versions}
    if not by_id:
        return grouped
    links = list((await db.scalars(
        select(Link).where(Link.business_id == business, Link.status == "active", Link.confirmed_version_id.in_(list(by_id)))
    )).all())
    asset_ids = [link.asset_id for link in links]
    assets = {}
    if asset_ids:
        assets = {
            row.id: row
            for row in (await db.scalars(select(Asset).where(Asset.business_id == business, Asset.id.in_(asset_ids)))).all()
        }
    for link in links:
        asset = assets.get(link.asset_id)
        knowledge = by_id.get(link.confirmed_version_id)
        if public_media_allowed(asset=asset, link=link, knowledge=knowledge, profile=profile, organization=organization):
            grouped[knowledge.id].append(asset)
    return grouped


async def bind_media_plan(db, business_id, title, summary, steps, media_choices=None):
    if media_choices is not None and len(media_choices) != len(steps):
        fail("asset_choice_rejected", 422)
    version_ids = [source for step in steps for source in step["sources"]]
    try:
        grouped = await eligible_for_versions(db, business_id, version_ids)
    except (OperationalError, ProgrammingError):
        grouped = {}
    blocks = []
    cover_assets = []
    for index, step in enumerate(steps):
        pool = []
        for source in step["sources"]:
            pool.extend(grouped.get(uid(source), []))
        unique = list({asset.id: asset for asset in pool}.values())
        choice = None if media_choices is None else media_choices[index]
        blocks.append(select_step_blocks(step["question"], step["answer"], unique, choice))
        cover_assets.extend(asset for asset in unique if asset.asset_type == "image")
    plan = {
        "coverAssetId": select_cover(title, summary, list({asset.id: asset for asset in cover_assets}.values())),
        "blocks": blocks,
        "seal": None,
    }
    return plan


async def assert_live_plan(db, business_id, steps, plan):
    if plan is None:
        return
    version_ids = [source for step in steps for source in step["sources"]]
    grouped = await eligible_for_versions(db, business_id, version_ids)
    if not plan_is_live(steps, plan, grouped):
        fail("sealed_media_unavailable", 409)
