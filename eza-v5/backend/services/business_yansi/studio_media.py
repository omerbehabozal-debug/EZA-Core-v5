"""Choose brand media for an eight-step Yansı without another model call.

The extractive Studio engine still writes the question and the source passage.
This module only accepts asset ids from the brand catalog confirmed on those
exact knowledge versions. A URL, coordinate, or file path is rejected.
"""
from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager

from sqlalchemy import select
from sqlalchemy.exc import OperationalError, ProgrammingError

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_brand_assets import BusinessKnowledgeAssetLink as Link
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessProfile
from backend.models.production import Organization
from backend.services.business_yansi.brand_assets import public_media_allowed, validate_https_url
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


def _measured_video(asset):
    """Return server-measured ticks only. Client fields are not read."""
    duration = getattr(asset, "verified_duration", None)
    scale = getattr(asset, "verified_timescale", None)
    size = getattr(asset, "verified_size_bytes", None)
    if type(duration) is not int or type(scale) is not int or type(size) is not int:
        return None
    if duration < 0 or scale <= 0 or size <= 0:
        return None
    if max(duration, scale, size) > 2**63 - 1:
        return None
    return duration, scale, size


def video_may_be_cover(asset) -> bool:
    """A new video cover needs the duration and size recorded at ingest.

    Locator type does not grant an exception. A video with missing or unusable
    facts is refused. Images are unchanged. This check is not used when an
    already published Yansı is read back.
    """
    if getattr(asset, "asset_type", None) != "video":
        return True
    measured = _measured_video(asset)
    if measured is None:
        return False
    duration, scale, size = measured
    from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS
    if size > COVER_MAX_BYTES:
        return False
    if duration > COVER_MAX_SECONDS * scale:
        return False
    heard = getattr(asset, "verified_has_audio", None)
    silent = heard is False or heard == 0
    return silent


def accept_cover_choice(cover_asset_id, assets):
    """A brand may name one eligible image or video. A URL is refused."""
    if cover_asset_id is None or cover_asset_id == "":
        return None
    token = str(cover_asset_id)
    try:
        token = str(uuid.UUID(token))
    except (ValueError, TypeError, AttributeError):
        fail("asset_choice_rejected", 422)
    match = next((asset for asset in assets if str(asset.id) == token and asset.asset_type in {"image", "video"}), None)
    if match is None:
        fail("asset_choice_rejected", 422)
    if not video_may_be_cover(match):
        fail("video_cover_rejected", 422)
    return str(match.id)


def select_cover(title, summary, assets, steps=None):
    """Pick the eligible cover that shares the most words with this Yansı.

    Images and silent video covers use the same score. The context is the
    title, summary, questions, and answers. Asset titles and captions are the
    metadata. A tie uses the asset id in lexicographic order. Job time and
    upload order are not part of the score.
    """
    parts = [title or "", summary or ""]
    for step in steps or []:
        if isinstance(step, dict):
            parts.append(str(step.get("question") or ""))
            parts.append(str(step.get("answer") or ""))
    covers = [asset for asset in assets if asset.asset_type in {"image", "video"} and video_may_be_cover(asset)]
    ranked = _rank(" ".join(parts), covers)
    if not ranked:
        return None
    return str(ranked[0].id)


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
    covers = {
        str(asset.id)
        for assets in grouped.values()
        for asset in assets
        if asset.asset_type in {"image", "video"}
    }
    return cover in covers


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


async def bind_media_plan(db, business_id, title, summary, steps, media_choices=None, cover_asset_id=None):
    if media_choices is not None and len(media_choices) != len(steps):
        fail("asset_choice_rejected", 422)
    version_ids = [source for step in steps for source in step["sources"]]
    try:
        from backend.services.business_yansi.cover_jobs import sync_ready_cover_links
        await sync_ready_cover_links(db, business_id)
    except (OperationalError, ProgrammingError):
        pass
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
        cover_assets.extend(asset for asset in unique if asset.asset_type in {"image", "video"})
    pool = list({asset.id: asset for asset in cover_assets}.values())
    explicit = not (cover_asset_id is None or cover_asset_id == "")
    if explicit:
        chosen = accept_cover_choice(cover_asset_id, pool)
        mode = "explicit"
    else:
        # Phase 7G-4c.2/3A: optional observation-assisted ranking on the existing
        # eligible pool only. Flag default-off preserves exact select_cover.
        # Callers (create/revise) hold business_media_lock for one rebuild+select+persist pass.
        from backend.services.business_yansi.observation_rank import (
            ranking_enabled,
            select_cover_ranked,
        )

        if ranking_enabled():
            from backend.services.business_yansi.cover_ranking_adapter import (
                build_cover_ranking_inputs,
            )

            observations, provenances = await build_cover_ranking_inputs(
                db, business_id, pool,
            )
            chosen = select_cover_ranked(
                title,
                summary,
                pool,
                steps,
                observations=observations,
                provenances=provenances,
            )
        else:
            chosen = select_cover(title, summary, pool, steps)
        mode = "automatic"
    plan = {
        "coverAssetId": chosen,
        "blocks": blocks,
        "seal": None,
        "coverMode": mode,
    }
    return plan


def _plan_uses_asset(plan, asset_id):
    if not isinstance(plan, dict):
        return False
    if str(plan.get("coverAssetId") or "") == asset_id:
        return True
    for step in plan.get("blocks") or []:
        for block in step or []:
            if isinstance(block, dict) and str(block.get("assetId") or "") == asset_id:
                return True
    return False


async def sealed_content_uses_asset(db, business_id, asset_id):
    """True when a sealed draft or a publication still shows this asset."""
    from backend.models.business_yansi import BusinessPublication
    from backend.models.business_yansi import BusinessYansiDraft

    token = str(asset_id)
    business = uid(business_id)
    draft_plans = await db.scalars(select(BusinessYansiDraft.media_plan).where(BusinessYansiDraft.business_id == business))
    for plan in draft_plans:
        if isinstance(plan, dict) and plan.get("seal") and _plan_uses_asset(plan, token):
            return True
    published = await db.scalars(select(BusinessPublication.media_plan).where(BusinessPublication.business_id == business))
    for plan in published:
        if _plan_uses_asset(plan, token):
            return True
    return False


@asynccontextmanager
async def business_media_lock(db, business_id):
    """Hold the brand row until the content change or the seal commits.

    Every writer takes this lock first, then its own draft, asset, or publication row.
    That order stops an asset update from landing after a seal that it did not see.
    """
    from backend.models.business_yansi import BusinessProfile

    row = await db.scalar(select(BusinessProfile).where(BusinessProfile.id == uid(business_id)).with_for_update())
    if row is None:
        fail("business_not_found", 404)
    yield row


async def assert_live_plan(db, business_id, steps, plan):
    if plan is None:
        return
    version_ids = [source for step in steps for source in step["sources"]]
    grouped = await eligible_for_versions(db, business_id, version_ids)
    if not plan_is_live(steps, plan, grouped):
        fail("sealed_media_unavailable", 409)
    cover = str((plan or {}).get("coverAssetId") or "")
    if cover:
        chosen = next((asset for rows in grouped.values() for asset in rows if str(asset.id) == cover), None)
        if chosen is not None and not video_may_be_cover(chosen):
            fail("video_cover_rejected", 422)


def media_asset_ids(blocks):
    """Ids selected for one answer, in display order. Nothing else is durable."""
    kept = []
    seen = set()
    for block in blocks or []:
        raw = block.get("assetId") if isinstance(block, dict) else None
        try:
            asset_id = str(uuid.UUID(str(raw)))
        except (ValueError, TypeError, AttributeError):
            continue
        if asset_id in seen:
            continue
        seen.add(asset_id)
        kept.append(asset_id)
    return kept


async def recall_media(db, business_id, asset_ids):
    """Show the same ids again only while they remain public for this brand."""
    shown = []
    for asset_id in media_asset_ids([{"assetId": item} for item in asset_ids or []]):
        asset = await live_public_asset(db, business_id, asset_id)
        if asset is None:
            continue
        view = public_block(asset)
        if view is not None:
            shown.append(view)
    return shown


def public_block(asset):
    """Public display fields. Storage keys and unvalidated remote addresses stay out."""
    kind = BLOCK_TYPES[asset.asset_type]
    block = {"type": kind, "assetId": str(asset.id), "title": asset.title or ""}
    if kind == "image":
        block["contentPath"] = f"/api/business-yansi/public-media/{asset.business_id}/{asset.id}"
        return block
    if kind == "map":
        if asset.latitude is None or asset.longitude is None:
            return None
        block["caption"] = asset.caption or ""
        block["latitude"] = format(asset.latitude, "f")
        block["longitude"] = format(asset.longitude, "f")
        return block
    try:
        block["href"] = validate_https_url(asset.locator)
    except Exception:
        return None
    if kind == "link":
        block["caption"] = asset.caption or ""
    return block


async def live_public_asset(db, business_id, asset_id):
    """Re-check brand, approval, version, and public access at the moment of display."""
    business = uid(business_id)
    asset = await db.get(Asset, uid(asset_id))
    if asset is None or asset.business_id != business:
        return None
    profile = await db.get(BusinessProfile, business)
    organization = await db.get(Organization, business)
    links = list((await db.scalars(select(Link).where(
        Link.asset_id == asset.id, Link.business_id == business, Link.status == "active"
    ))).all())
    for link in links:
        knowledge = await db.get(Knowledge, link.confirmed_version_id)
        if public_media_allowed(asset=asset, link=link, knowledge=knowledge, profile=profile, organization=organization):
            return asset
    return None


def _present_chosen(chosen, assets):
    by_id = {str(asset.id): asset for asset in assets}
    shown = []
    for block in chosen:
        asset = by_id.get(str(block.get("assetId")))
        if asset is None or BLOCK_TYPES.get(asset.asset_type) != block.get("type"):
            continue
        view = public_block(asset)
        if view is not None:
            shown.append(view)
    return shown


async def answer_media(db, business_id, answer_text, sources):
    """Media for an answer that already exists. No model call and no quota event."""
    version_ids = []
    for source in sources or []:
        raw = source.get("knowledge_version_id") if isinstance(source, dict) else None
        try:
            version_ids.append(str(uuid.UUID(str(raw))))
        except (ValueError, TypeError, AttributeError):
            continue
    if not version_ids:
        return []
    try:
        grouped = await eligible_for_versions(db, business_id, version_ids)
    except (OperationalError, ProgrammingError):
        return []
    pool = []
    for version_id in version_ids:
        pool.extend(grouped.get(uid(version_id), []))
    unique = list({asset.id: asset for asset in pool}.values())
    return _present_chosen(select_step_blocks(answer_text, answer_text, unique), unique)


async def publication_media(db, slug, version):
    """Sealed Yansı media that is still public. Revoked ids disappear and are not replaced."""
    from backend.models.business_yansi import BusinessPublication
    try:
        row = await db.get(BusinessPublication, (slug, int(version)))
    except (OperationalError, ProgrammingError):
        return None
    plan = getattr(row, "media_plan", None) if row is not None else None
    if not plan:
        return None
    wanted = []
    if plan.get("coverAssetId"):
        wanted.append(plan["coverAssetId"])
    for step in plan.get("blocks") or []:
        for block in step or []:
            if isinstance(block, dict) and block.get("assetId"):
                wanted.append(block["assetId"])
    live = {}
    for asset_id in wanted:
        asset = await live_public_asset(db, row.business_id, asset_id)
        if asset is not None:
            live[str(asset.id)] = asset
    cover = None
    cover_asset = live.get(str(plan.get("coverAssetId")))
    if cover_asset is not None and cover_asset.asset_type in {"image", "video"}:
        cover = public_block(cover_asset)
    steps = [_present_chosen(step or [], live.values()) for step in plan.get("blocks") or []]
    if cover is None and not any(steps):
        return None
    return {"cover": cover, "steps": steps}
