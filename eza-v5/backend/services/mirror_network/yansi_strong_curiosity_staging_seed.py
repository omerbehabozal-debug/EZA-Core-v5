# -*- coding: utf-8 -*-
"""
Phase 7.4.3a — staging corpus seed for frozen Strong Curiosity evaluation.

Creates synthetic Discover-eligible frozen Journey roots + children + Phase 6
events. Does not rank, personalize, or activate Güçlü Merak.

Must not run in production. Must not be imported by public Discover listing.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence
from uuid import UUID, uuid5, NAMESPACE_URL

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings, is_production_settings
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorJourneyStep,
    MirrorNetworkNode,
)
from backend.models.production import User
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.models.yansi_exposure_event import YansiExposureEvent
from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.services.mirror_network.discover import load_discover_eligible_roots
from backend.services.mirror_network.frozen_journey_artifact import (
    FREEZE_STATUS_FROZEN,
    attach_frozen_journey_artifact,
)
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    evaluate_strong_curiosity_candidates_batch,
)
from backend.services.mirror_network.yansi_metrics import get_yansi_public_metrics

SEED_BATCH_ID = "phase743a-v1"
SLUG_PREFIX = "p743a-"
EMAIL_DOMAIN = "fixtures.bilign.test"
SCENE_URL = "https://cdn.example/phase743a-scene.png"
ALLOWED_ENVS = frozenset({"staging", "test", "ci", "development", "dev"})
PRODUCTION_ENVS = frozenset({"prod", "production"})
SIZE_PRESETS = {"small": 56, "medium": 250, "large": 1000}
ANCHOR = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
AUTHOR_HANDLES = (
    "alice", "bob", "carol", "dave", "eve", "frank", "grace", "heidi",
    "ivan", "judy", "mallory", "niaj", "olivia", "peggy", "quentin", "rupert",
    "sybil", "trent", "uma", "victor", "wendy", "xavier", "yvonne", "zoe",
)
LOCALES = ("tr", "en", "ar")
TOPICS = (
    "history",
    "science",
    "architecture",
    "psychology",
    "technology",
    "culture",
    "daily-life",
)
AGE_BUCKETS = (3, 14, 45, 180, 420)
ARCHETYPE_CYCLE = (
    "mass",
    "small_generative",
    "balanced",
    "engagement_heavy",
    "generativity_heavy",
    "low_sample_perfect",
    "low_sample_mixed",
    "self_play",
    "child_self_farm",
    "external_diversity",
    "auth_concentrated",
    "auth_diverse",
    "guest_heavy",
    "historical",
    "brand_new",
    "old_high_volume",
    "newer_supported",
    "skip_complete",
    "selected_6",
    "selected_7",
    "selected_8",
    "scope_incompatible",
    "no_child",
    "multi_author_network",
)
PASSWORD_STUB = hashlib.sha256(b"phase743a-fixture-not-login").hexdigest()


class StagingSeedError(RuntimeError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class RootSpec:
    slug: str
    archetype: str
    author_handle: str
    version: int
    selected_count: int
    age_days: int
    locale: str
    topic: str
    author_self_starts: int
    guest_starts: int
    external_starts: int
    unique_external_viewers: int
    completed: int
    skipped: int
    skip_then_complete: bool
    self_children: int
    external_children: int
    unique_external_child_authors: int
    continuations: int
    exposures: int
    grandchild: bool
    child_slugs: list[str] = field(default_factory=list)
    grandchild_slug: str | None = None


def resolve_seed_env_label(settings: Any | None = None) -> str:
    cfg = settings or get_settings()
    eza = str(getattr(cfg, "EZA_ENV", None) or "").strip().lower()
    env = str(getattr(cfg, "ENV", None) or "").strip().lower()
    return eza or env


def assert_seed_environment(settings: Any | None = None) -> str:
    cfg = settings or get_settings()
    label = resolve_seed_env_label(cfg)
    if not label:
        raise StagingSeedError("environment_unresolved")
    if label in PRODUCTION_ENVS or is_production_settings(cfg):
        raise StagingSeedError("production_seed_forbidden")
    if label not in ALLOWED_ENVS:
        raise StagingSeedError(f"environment_not_allowed:{label}")
    return label


def fixture_user_id(handle: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"{SEED_BATCH_ID}:user:{handle}")


def fixture_email(handle: str) -> str:
    return f"phase743a+{handle}@{EMAIL_DOMAIN}"


def fixture_uuid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"{SEED_BATCH_ID}:{name}"))


def _root_slug(index: int, archetype: str) -> str:
    short = archetype.replace("_", "")[:10]
    return f"{SLUG_PREFIX}{short}-{index:03d}"[:64]


def _child_slug(parent: str, index: int) -> str:
    return f"{parent}-c{index:02d}"[:64]


def _counts_for(archetype: str, index: int) -> dict[str, Any]:
    wave = (index % 5) + 1
    selected = 8
    version = 1
    if archetype == "selected_6":
        selected = 6
    elif archetype == "selected_7":
        selected = 7
    elif archetype == "selected_8":
        selected = 8
    elif archetype == "scope_incompatible":
        version = 2
    if archetype == "mass":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=8, external_starts=40 + wave * 8, unique_external_viewers=12, completed=30, skipped=4, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=6, grandchild=False)
    if archetype == "small_generative":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=6 + wave, unique_external_viewers=5, completed=5, skipped=0, skip_then_complete=False, self_children=0, external_children=5 + (wave % 3), unique_external_child_authors=4 + (wave % 3), continuations=3, exposures=2, grandchild=False)
    if archetype == "balanced":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=2, external_starts=18 + wave * 2, unique_external_viewers=10, completed=12, skipped=2, skip_then_complete=False, self_children=1, external_children=4, unique_external_child_authors=3, continuations=2, exposures=3, grandchild=False)
    if archetype == "engagement_heavy":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=24 + wave * 2, unique_external_viewers=14, completed=20, skipped=1, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=4, grandchild=False)
    if archetype == "generativity_heavy":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=10, unique_external_viewers=7, completed=6, skipped=0, skip_then_complete=False, self_children=1, external_children=6, unique_external_child_authors=5, continuations=4, exposures=1, grandchild=False)
    if archetype == "low_sample_perfect":
        n = 1 + ((index // len(ARCHETYPE_CYCLE)) % 2)
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=n, unique_external_viewers=n, completed=n, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=0, grandchild=False)
    if archetype == "low_sample_mixed":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=2, unique_external_viewers=2, completed=1, skipped=1, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=0, grandchild=False)
    if archetype == "self_play":
        return dict(selected_count=selected, version=version, author_self_starts=18, guest_starts=0, external_starts=5, unique_external_viewers=4, completed=8, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=1, grandchild=False)
    if archetype == "child_self_farm":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=12, unique_external_viewers=6, completed=6, skipped=0, skip_then_complete=False, self_children=6, external_children=1, unique_external_child_authors=1, continuations=1, exposures=1, grandchild=False)
    if archetype == "external_diversity":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=10, unique_external_viewers=6, completed=5, skipped=0, skip_then_complete=False, self_children=0, external_children=6, unique_external_child_authors=6, continuations=3, exposures=1, grandchild=False)
    if archetype == "auth_concentrated":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=20, unique_external_viewers=1, completed=12, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=2, grandchild=False)
    if archetype == "auth_diverse":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=20, unique_external_viewers=14, completed=12, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=2, grandchild=False)
    if archetype == "guest_heavy":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=22, external_starts=0, unique_external_viewers=0, completed=8, skipped=3, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=3, grandchild=False)
    if archetype == "historical":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=0, unique_external_viewers=0, completed=0, skipped=0, skip_then_complete=False, self_children=0, external_children=4, unique_external_child_authors=4, continuations=0, exposures=0, grandchild=False)
    if archetype == "brand_new":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=0, unique_external_viewers=0, completed=0, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=0, grandchild=False)
    if archetype == "old_high_volume":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=4, external_starts=36, unique_external_viewers=11, completed=22, skipped=5, skip_then_complete=False, self_children=0, external_children=1, unique_external_child_authors=1, continuations=1, exposures=5, grandchild=False)
    if archetype == "newer_supported":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=1, external_starts=16, unique_external_viewers=9, completed=10, skipped=1, skip_then_complete=False, self_children=0, external_children=2, unique_external_child_authors=2, continuations=1, exposures=2, grandchild=False)
    if archetype == "skip_complete":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=12, unique_external_viewers=8, completed=12, skipped=12, skip_then_complete=True, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=1, grandchild=False)
    if archetype in {"selected_6", "selected_7", "selected_8"}:
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=8, unique_external_viewers=5, completed=4, skipped=1, skip_then_complete=False, self_children=0, external_children=1, unique_external_child_authors=1, continuations=1, exposures=1, grandchild=False)
    if archetype == "scope_incompatible":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=14, unique_external_viewers=8, completed=7, skipped=0, skip_then_complete=False, self_children=0, external_children=3, unique_external_child_authors=3, continuations=2, exposures=1, grandchild=False)
    if archetype == "no_child":
        return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=9, unique_external_viewers=6, completed=5, skipped=0, skip_then_complete=False, self_children=0, external_children=0, unique_external_child_authors=0, continuations=0, exposures=1, grandchild=False)
    # multi_author_network
    return dict(selected_count=selected, version=version, author_self_starts=0, guest_starts=0, external_starts=11, unique_external_viewers=7, completed=6, skipped=0, skip_then_complete=False, self_children=0, external_children=4, unique_external_child_authors=4, continuations=3, exposures=2, grandchild=True)


def build_staging_seed_plan(
    *,
    size: str = "medium",
    seed: str = SEED_BATCH_ID,
    anchor: datetime | None = None,
) -> dict[str, Any]:
    if size not in SIZE_PRESETS:
        raise StagingSeedError(f"unknown_size:{size}")
    n = SIZE_PRESETS[size]
    now = anchor or ANCHOR
    roots: list[RootSpec] = []
    for index in range(n):
        archetype = ARCHETYPE_CYCLE[index % len(ARCHETYPE_CYCLE)]
        handle = AUTHOR_HANDLES[index % len(AUTHOR_HANDLES)]
        if archetype in {"mass", "old_high_volume"} and index % 3 == 0:
            handle = "alice"
        if archetype == "brand_new":
            age = 2
        elif archetype == "old_high_volume":
            age = 420
        elif archetype == "newer_supported":
            age = 14
        else:
            age = AGE_BUCKETS[index % len(AGE_BUCKETS)]
        counts = _counts_for(archetype, index)
        slug = _root_slug(index, archetype)
        child_slugs = [
            _child_slug(slug, i)
            for i in range(int(counts["self_children"]) + int(counts["external_children"]))
        ]
        grandchild = None
        if counts["grandchild"] and child_slugs:
            grandchild = f"{child_slugs[0]}-gc01"[:64]
        roots.append(
            RootSpec(
                slug=slug,
                archetype=archetype,
                author_handle=handle,
                version=int(counts["version"]),
                selected_count=int(counts["selected_count"]),
                age_days=int(age),
                locale=LOCALES[index % len(LOCALES)],
                topic=TOPICS[index % len(TOPICS)],
                author_self_starts=int(counts["author_self_starts"]),
                guest_starts=int(counts["guest_starts"]),
                external_starts=int(counts["external_starts"]),
                unique_external_viewers=int(counts["unique_external_viewers"]),
                completed=int(counts["completed"]),
                skipped=int(counts["skipped"]),
                skip_then_complete=bool(counts["skip_then_complete"]),
                self_children=int(counts["self_children"]),
                external_children=int(counts["external_children"]),
                unique_external_child_authors=int(counts["unique_external_child_authors"]),
                continuations=int(counts["continuations"]),
                exposures=int(counts["exposures"]),
                grandchild=bool(counts["grandchild"]),
                child_slugs=child_slugs,
                grandchild_slug=grandchild,
            )
        )
    authors = list(AUTHOR_HANDLES)
    child_author_handles = [
        AUTHOR_HANDLES[(i + 3) % len(AUTHOR_HANDLES)] for i in range(len(AUTHOR_HANDLES))
    ]
    plan = {
        "seed": seed,
        "size": size,
        "rootCount": len(roots),
        "authorHandles": authors,
        "childAuthorHandles": child_author_handles,
        "archetypeCounts": {
            name: sum(1 for row in roots if row.archetype == name) for name in ARCHETYPE_CYCLE
        },
        "anchor": now.isoformat(),
        "namespace": SLUG_PREFIX,
        "batchId": SEED_BATCH_ID,
        "roots": [asdict(row) for row in roots],
        "intended": _intended_counts(roots),
    }
    return plan


def _intended_counts(roots: Sequence[RootSpec]) -> dict[str, int]:
    children = sum(len(row.child_slugs) for row in roots)
    grandchildren = sum(1 for row in roots if row.grandchild_slug)
    starts = sum(
        row.author_self_starts + row.guest_starts + row.external_starts for row in roots
    )
    completed = sum(min(row.completed, row.author_self_starts + row.guest_starts + row.external_starts) for row in roots)
    skipped = sum(row.skipped for row in roots)
    continuations = sum(row.continuations for row in roots)
    exposures = sum(row.exposures for row in roots)
    return {
        "users": len(AUTHOR_HANDLES),
        "roots": len(roots),
        "children": children,
        "grandchildren": grandchildren,
        "experienceStarted": starts,
        "experienceCompleted": completed,
        "experienceSkipped": skipped,
        "continuations": continuations,
        "exposures": exposures,
    }


def _steps(selected: int, tag: str) -> list[dict[str, str]]:
    return [
        {
            "stepIndex": i,
            "publicQuestion": f"{tag} fixture question {i}?",
            "publicAnswer": f"{tag} fixture answer {i}.",
        }
        for i in range(1, selected + 1)
    ]


def _frozen_dict(
    *,
    slug: str,
    version: int,
    author_id: str,
    parent: str | None,
    selected: int,
    title: str,
    summary: str,
) -> dict[str, Any]:
    return {
        "contractVersion": "frozen_journey_artifact_v1",
        "freezeStatus": FREEZE_STATUS_FROZEN,
        "journeyId": slug,
        "slug": slug,
        "journeyVersion": version,
        "authorUserId": author_id,
        "parentSlug": parent,
        "selectedCount": selected,
        "sceneImageUrl": SCENE_URL,
        "publicLanding": {
            "publicTitle": title,
            "publicSummary": summary,
        },
    }


async def _upsert_user(db: AsyncSession, handle: str) -> User:
    email = fixture_email(handle)
    uid = fixture_user_id(handle)
    result = await db.execute(select(User).where(User.email == email))
    row = result.scalar_one_or_none()
    if row is None:
        row = User(
            id=uid,
            email=email,
            password_hash=PASSWORD_STUB,
            role="user",
            is_active=True,
            is_internal_test_user=True,
            mirror_plan="free",
            created_at=ANCHOR,
        )
        db.add(row)
        await db.flush()
        return row
    row.is_internal_test_user = True
    row.is_active = True
    return row


async def _upsert_node(
    db: AsyncSession,
    *,
    slug: str,
    author: User,
    parent: str | None,
    version: int,
    selected: int,
    published_at: datetime,
    locale: str,
    topic: str,
    title: str,
) -> MirrorNetworkNode:
    summary = "Phase 7.4.3a synthetic staging fixture. No private conversation content."
    public_payload = {
        "publicTitle": title,
        "publicSummary": summary,
        "sceneImageUrl": SCENE_URL,
        "seed": {
            "locale": locale,
            "topicCategory": topic,
            "seedBatchId": SEED_BATCH_ID,
        },
    }
    frozen = _frozen_dict(
        slug=slug,
        version=version,
        author_id=str(author.id),
        parent=parent,
        selected=selected,
        title=title,
        summary=summary,
    )
    private_payload = attach_frozen_journey_artifact(
        {"intelligenceBrief": {"seedBatchId": SEED_BATCH_ID}},
        frozen,
        archive_previous=False,
    )
    result = await db.execute(select(MirrorNetworkNode).where(MirrorNetworkNode.slug == slug))
    node = result.scalar_one_or_none()
    if node is None:
        node = MirrorNetworkNode(
            slug=slug,
            user_id=author.id,
            conversation_id=f"{SEED_BATCH_ID}:{slug}"[:128],
            visibility="public",
            safety_status="open",
            card_title=title[:200],
            card_date=published_at.date().isoformat(),
            scene_image_url=SCENE_URL,
            public_payload=public_payload,
            private_payload=private_payload,
            parent_slug=parent,
            artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
            journey_version=version,
            window_index=0,
            window_start=0,
            window_end=selected - 1,
            freeze_status=FREEZE_STATUS_FROZEN,
            frozen_at=published_at,
            published_at=published_at,
        )
        db.add(node)
    else:
        node.user_id = author.id
        node.visibility = "public"
        node.safety_status = "open"
        node.card_title = title[:200]
        node.scene_image_url = SCENE_URL
        node.public_payload = public_payload
        node.private_payload = private_payload
        node.parent_slug = parent
        node.artifact_kind = ARTIFACT_KIND_JOURNEY_V1
        node.journey_version = version
        node.freeze_status = FREEZE_STATUS_FROZEN
        node.frozen_at = published_at
        node.published_at = published_at
    await db.flush()
    await db.execute(delete(MirrorJourneyStep).where(MirrorJourneyStep.journey_slug == slug))
    for step in _steps(selected, slug[-8:]):
        db.add(
            MirrorJourneyStep(
                journey_slug=slug,
                journey_version=version,
                step_index=int(step["stepIndex"]),
                public_question=step["publicQuestion"],
                public_answer=step["publicAnswer"],
            )
        )
    return node


def _viewer_sequence(spec: RootSpec) -> list[str | None]:
    viewers: list[str | None] = []
    author_id = str(fixture_user_id(spec.author_handle))
    viewers.extend([author_id] * spec.author_self_starts)
    viewers.extend([None] * spec.guest_starts)
    unique = max(spec.unique_external_viewers, 1 if spec.external_starts else 0)
    for i in range(spec.external_starts):
        handle = AUTHOR_HANDLES[(i % unique) + 1]
        if handle == spec.author_handle:
            handle = AUTHOR_HANDLES[(i + 5) % len(AUTHOR_HANDLES)]
        viewers.append(str(fixture_user_id(handle)))
    return viewers


async def _replace_events(db: AsyncSession, spec: RootSpec) -> None:
    slug = spec.slug
    await db.execute(delete(YansiExperienceEvent).where(YansiExperienceEvent.mirror_slug == slug))
    await db.execute(delete(YansiExposureEvent).where(YansiExposureEvent.mirror_slug == slug))
    await db.execute(
        delete(YansiOwnContinuationEvent).where(YansiOwnContinuationEvent.origin_mirror_slug == slug)
    )
    viewers = _viewer_sequence(spec)
    started_sessions: list[tuple[str, str | None]] = []
    for i, viewer in enumerate(viewers):
        session_id = fixture_uuid(f"exp:{slug}:{i}")
        started_sessions.append((session_id, viewer))
        db.add(
            YansiExperienceEvent(
                event_id=fixture_uuid(f"started:{slug}:{i}"),
                experience_session_id=session_id,
                event_type=YANSI_EXPERIENCE_STARTED,
                mirror_slug=slug,
                journey_version=spec.version,
                viewer_user_id=viewer,
            )
        )
    complete_n = min(spec.completed, len(started_sessions))
    for i in range(complete_n):
        session_id, viewer = started_sessions[i]
        db.add(
            YansiExperienceEvent(
                event_id=fixture_uuid(f"completed:{slug}:{i}"),
                experience_session_id=session_id,
                event_type=YANSI_EXPERIENCE_COMPLETED,
                mirror_slug=slug,
                journey_version=spec.version,
                viewer_user_id=viewer,
                completed_step_count=spec.selected_count,
            )
        )
    skip_n = min(spec.skipped, len(started_sessions))
    dest = spec.child_slugs[0] if spec.child_slugs else f"{slug}-skipdest"
    for i in range(skip_n):
        session_id, viewer = started_sessions[i if spec.skip_then_complete else -1 - i]
        db.add(
            YansiExperienceEvent(
                event_id=fixture_uuid(f"skipped:{slug}:{i}"),
                experience_session_id=session_id,
                event_type=YANSI_EXPERIENCE_SKIPPED,
                mirror_slug=slug,
                journey_version=spec.version,
                viewer_user_id=viewer,
                completed_step_count=2,
                destination_slug=dest[:128],
            )
        )
    for i in range(spec.exposures):
        db.add(
            YansiExposureEvent(
                event_id=fixture_uuid(f"expore:{slug}:{i}"),
                exposure_session_id=fixture_uuid(f"expsess:{slug}:{i}"),
                mirror_slug=slug,
                journey_version=spec.version,
                context=("discover", "landing", "chain", "public_profile")[i % 4],
                viewer_user_id=_viewer_sequence(spec)[i] if viewers else None,
            )
        )
    for i in range(spec.continuations):
        db.add(
            YansiOwnContinuationEvent(
                event_id=fixture_uuid(f"cont:{slug}:{i}"),
                continuation_session_id=fixture_uuid(f"contsess:{slug}:{i}"),
                origin_mirror_slug=slug,
                origin_journey_version=spec.version,
                viewer_user_id=str(fixture_user_id(AUTHOR_HANDLES[(i + 4) % len(AUTHOR_HANDLES)])),
            )
        )


async def persist_staging_corpus(
    db: AsyncSession,
    *,
    size: str = "medium",
    seed: str = SEED_BATCH_ID,
    settings: Any | None = None,
    commit: bool = True,
) -> dict[str, Any]:
    env_label = assert_seed_environment(settings)
    plan = build_staging_seed_plan(size=size, seed=seed)
    users = {handle: await _upsert_user(db, handle) for handle in AUTHOR_HANDLES}
    specs = [RootSpec(**row) for row in plan["roots"]]
    for spec in specs:
        author = users[spec.author_handle]
        published = ANCHOR - timedelta(days=spec.age_days)
        await _upsert_node(
            db,
            slug=spec.slug,
            author=author,
            parent=None,
            version=spec.version,
            selected=spec.selected_count,
            published_at=published,
            locale=spec.locale,
            topic=spec.topic,
            title=f"{spec.archetype} {spec.slug}",
        )
        for offset, child_slug in enumerate(spec.child_slugs):
            if offset < spec.self_children:
                child_author = author
            else:
                ext_index = offset - spec.self_children
                cap = max(1, spec.unique_external_child_authors)
                handle = AUTHOR_HANDLES[(ext_index % cap) + 2]
                if handle == spec.author_handle:
                    handle = AUTHOR_HANDLES[(ext_index + 7) % len(AUTHOR_HANDLES)]
                child_author = users[handle]
            await _upsert_node(
                db,
                slug=child_slug,
                author=child_author,
                parent=spec.slug,
                version=1,
                selected=spec.selected_count,
                published_at=published + timedelta(days=1),
                locale=spec.locale,
                topic=spec.topic,
                title=f"child of {spec.slug}",
            )
        if spec.grandchild_slug and spec.child_slugs:
            await _upsert_node(
                db,
                slug=spec.grandchild_slug,
                author=users["zoe"],
                parent=spec.child_slugs[0],
                version=1,
                selected=6,
                published_at=published + timedelta(days=2),
                locale=spec.locale,
                topic=spec.topic,
                title=f"grandchild of {spec.slug}",
            )
        await _replace_events(db, spec)
    if commit:
        await db.commit()
    else:
        await db.flush()
    validation = await validate_staging_corpus(db, expected_roots=plan["rootCount"])
    return {
        "environment": env_label,
        "plan": {key: plan[key] for key in ("seed", "size", "rootCount", "archetypeCounts", "intended", "namespace", "batchId")},
        "validation": validation,
        "mutated": True,
        "databaseUrlPrinted": False,
    }


async def cleanup_staging_corpus(db: AsyncSession, *, commit: bool = True) -> dict[str, int]:
    slug_match = f"{SLUG_PREFIX}%"
    exp = await db.execute(
        delete(YansiExperienceEvent).where(YansiExperienceEvent.mirror_slug.like(slug_match))
    )
    expo = await db.execute(
        delete(YansiExposureEvent).where(YansiExposureEvent.mirror_slug.like(slug_match))
    )
    cont = await db.execute(
        delete(YansiOwnContinuationEvent).where(
            YansiOwnContinuationEvent.origin_mirror_slug.like(slug_match)
        )
    )
    steps = await db.execute(
        delete(MirrorJourneyStep).where(MirrorJourneyStep.journey_slug.like(slug_match))
    )
    nodes = await db.execute(
        delete(MirrorNetworkNode).where(MirrorNetworkNode.slug.like(slug_match))
    )
    users = await db.execute(
        delete(User).where(User.email.like(f"phase743a+%@{EMAIL_DOMAIN}"))
    )
    if commit:
        await db.commit()
    removed = {
        "experienceEvents": int(exp.rowcount or 0),
        "exposureEvents": int(expo.rowcount or 0),
        "continuationEvents": int(cont.rowcount or 0),
        "steps": int(steps.rowcount or 0),
        "nodes": int(nodes.rowcount or 0),
        "users": int(users.rowcount or 0),
    }
    return removed


async def validate_staging_corpus(db: AsyncSession, *, expected_roots: int) -> dict[str, Any]:
    eligible = await load_discover_eligible_roots(db)
    slugs = [(node.slug, int(getattr(node, "journey_version", None) or 1)) for node, _ in eligible]
    profiles = await evaluate_strong_curiosity_candidates_batch(
        db, slugs, discover_eligible=set(slugs), evaluated_at=ANCHOR
    )
    pool = [row for row in profiles if row.get("inCandidatePool")]
    authors = {
        str(getattr(node, "user_id", ""))
        for node, _ in eligible
        if getattr(node, "user_id", None)
    }
    gen = sum(
        1
        for row in pool
        if int((row.get("generativityEvidence") or {}).get("distinctExternalChildAuthorCount") or 0) >= 1
    )
    historical = sum(1 for row in profiles if row.get("candidateState") == "HISTORICAL_ONLY")
    low = sum(1 for row in pool if row.get("smallSample"))
    self_play = sum(
        1
        for row in pool
        if int((row.get("selfInteraction") or {}).get("authorSelfStartedSessions") or 0) >= 5
    )
    auth_conc = sum(
        1
        for row in pool
        if int((row.get("selfInteraction") or {}).get("rankingEligibleStartedCount") or 0) >= 8
        and int(
            (row.get("uniqueViewerEvidence") or {}).get("uniqueAuthenticatedStartedViewerCount") or 0
        )
        <= 2
    )
    payload = {
        "eligibleRoots": len(eligible),
        "candidatePool": len(pool),
        "distinctAuthors": len(authors),
        "externalGenerativityCandidates": gen,
        "historicalOnly": historical,
        "lowSample": low,
        "selfPlay": self_play,
        "authConcentrated": auth_conc,
        "expectedRoots": expected_roots,
    }
    if len(eligible) < 50:
        raise StagingSeedError(f"eligible_roots_below_minimum:{len(eligible)}")
    if len(pool) < 20:
        raise StagingSeedError(f"candidate_pool_below_minimum:{len(pool)}")
    if len(authors) < 8:
        raise StagingSeedError("author_diversity_below_minimum")
    if gen < 5:
        raise StagingSeedError("external_generativity_below_minimum")
    if historical < 2:
        raise StagingSeedError("historical_below_minimum")
    if low < 2:
        raise StagingSeedError("low_sample_below_minimum")
    if self_play < 1:
        raise StagingSeedError("self_play_missing")
    if auth_conc < 1:
        raise StagingSeedError("auth_concentration_missing")
    return payload


async def metrics_for_slug(db: AsyncSession, slug: str, version: int = 1) -> dict[str, int]:
    return await get_yansi_public_metrics(db, slug=slug, journey_version=version)
