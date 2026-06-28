# -*- coding: utf-8 -*-
"""
Public/private payload separation — Mirror Network Stage 1.

Public payload never includes raw conversation, user identity, behavioral analysis,
full intelligence, or private metadata.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Mapping, Optional

from backend.core.schemas.mirror_network import (
    MirrorNetworkPrivatePayload,
    MirrorNetworkPublicAudit,
    MirrorNetworkPublicPayload,
    MirrorSeedPublic,
)
from backend.services.mirror_network.slug import build_mirror_share_url

FORBIDDEN_PUBLIC_TOP_LEVEL_KEYS = frozenset(
    {
        "userId",
        "user_id",
        "email",
        "conversationId",
        "conversation_id",
        "mirrorBody",
        "mirrorText",
        "topicSummary",
        "conversationEvidence",
        "evidenceLabels",
        "intelligenceBrief",
        "behavioralSnapshot",
        "behavioral",
        "privatePayload",
        "private_payload",
        "curiosityPipeline",
        "publicTopicHint",
        "visualDirection",
        "selectedTopic",
        "candidateTopics",
        "userLine",
        "aiLine",
        "entries",
        "messages",
    }
)

FORBIDDEN_VALUE_PATTERNS: List[re.Pattern[str]] = [
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    re.compile(r"\bconversation summary\b", re.I),
    re.compile(r"\bsohbet özeti\b", re.I),
]


def _as_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def build_mirror_seed_public(seed: Mapping[str, Any]) -> MirrorSeedPublic:
    safety = _as_str(seed.get("safetyTier") or seed.get("safety_tier") or "open")
    if safety not in ("open", "review"):
        safety = "open"
    return MirrorSeedPublic(
        topicCategory=_as_str(seed.get("topicCategory") or seed.get("topic_category") or "general"),
        mood=_as_str(seed.get("mood") or "discovery"),
        subtopics=list(seed.get("subtopics") or [])[:6],
        curiosityHooks=list(seed.get("curiosityHooks") or seed.get("curiosity_hooks") or [])[:5],
        seedQuestions=list(seed.get("seedQuestions") or seed.get("seed_questions") or [])[:5],
        locale=_as_str(seed.get("locale") or "tr") or "tr",
        lineage=_as_str(seed.get("lineage")) or None,
        safetyTier=safety,  # type: ignore[arg-type]
    )


def build_public_payload_from_curiosity(
    *,
    slug: str,
    card_title: str,
    card_date: str,
    scene_image_url: Optional[str],
    curiosity_public: Mapping[str, Any],
    parent_slug: Optional[str] = None,
) -> MirrorNetworkPublicPayload:
    seed_raw = curiosity_public.get("seed") or {}
    if not isinstance(seed_raw, dict):
        seed_raw = {}

    return MirrorNetworkPublicPayload(
        slug=slug,
        shareUrl=build_mirror_share_url(slug),
        cardTitle=card_title,
        cardDate=card_date,
        sceneImageUrl=scene_image_url,
        coreCuriosity=_as_str(curiosity_public.get("coreCuriosity") or curiosity_public.get("core_curiosity")),
        curiosityContext=_as_str(
            (curiosity_public.get("curiosityContext") or {}).get("text")
            if isinstance(curiosity_public.get("curiosityContext"), dict)
            else curiosity_public.get("curiosityContext")
            or curiosity_public.get("curiosity_context")
        ),
        landingContext=_as_str(curiosity_public.get("landingContext") or curiosity_public.get("landing_context")),
        hooks=list(curiosity_public.get("hooks") or [])[:6],
        seedQuestions=list(curiosity_public.get("seedQuestions") or curiosity_public.get("seed_questions") or [])[:5],
        discoverySignals=list(
            curiosity_public.get("discoverySignals") or curiosity_public.get("discovery_signals") or []
        )[:8],
        collectionTags=list(
            curiosity_public.get("collectionTags") or curiosity_public.get("collection_tags") or []
        )[:8],
        seed=build_mirror_seed_public(seed_raw),
        lineage=parent_slug or _as_str(seed_raw.get("lineage")) or None,
        shareVoice=_as_str(
            (curiosity_public.get("shareVoice") or {}).get("text")
            if isinstance(curiosity_public.get("shareVoice"), dict)
            else curiosity_public.get("shareVoice")
        )
        or None,
    )


def build_private_payload(
    *,
    user_id: str,
    conversation_id: Optional[str],
    curiosity_private: Mapping[str, Any],
) -> MirrorNetworkPrivatePayload:
    return MirrorNetworkPrivatePayload(
        userId=user_id,
        conversationId=conversation_id,
        mirrorBody=_as_str(curiosity_private.get("mirrorBody") or curiosity_private.get("mirror_body")) or None,
        topicSummary=_as_str(curiosity_private.get("topicSummary") or curiosity_private.get("topic_summary")) or None,
        evidenceLabels=list(curiosity_private.get("evidenceLabels") or curiosity_private.get("evidence_labels") or []),
        intelligenceBrief=curiosity_private.get("intelligenceBrief") or curiosity_private.get("intelligence_brief"),
        behavioralSnapshot=curiosity_private.get("behavioralSnapshot") or curiosity_private.get("behavioral_snapshot"),
        curiosityPipeline=curiosity_private.get("curiosityPipeline") or curiosity_private.get("curiosity_pipeline"),
    )


def audit_public_payload(payload: MirrorNetworkPublicPayload) -> MirrorNetworkPublicAudit:
    forbidden_keys: List[str] = []
    forbidden_patterns: List[str] = []

    def walk(obj: Any, path: str = "") -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                key_path = f"{path}.{key}" if path else str(key)
                if str(key) in FORBIDDEN_PUBLIC_TOP_LEVEL_KEYS or _is_private_key(str(key)):
                    forbidden_keys.append(key_path)
                walk(value, key_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                walk(item, f"{path}[{i}]")
        elif isinstance(obj, str):
            for pattern in FORBIDDEN_VALUE_PATTERNS:
                if pattern.search(obj):
                    forbidden_patterns.append(f"{path}: {pattern.pattern}")
                    break

    walk(payload.model_dump())
    return MirrorNetworkPublicAudit(
        passed=not forbidden_keys and not forbidden_patterns,
        forbiddenKeysFound=sorted(set(forbidden_keys)),
        forbiddenValuePatternsFound=sorted(set(forbidden_patterns)),
    )


def _is_private_key(key: str) -> bool:
    lowered = key.lower()
    private_markers = (
        "user",
        "email",
        "conversation",
        "behavioral",
        "intelligence",
        "evidence",
        "mirrorbody",
        "mirrortext",
        "private",
        "password",
        "token",
    )
    return any(marker in lowered for marker in private_markers)


def split_curiosity_payloads(
    *,
    slug: str,
    card_title: str,
    card_date: str,
    scene_image_url: Optional[str],
    user_id: str,
    conversation_id: Optional[str],
    curiosity_bundle: Mapping[str, Any],
    intelligence_private: Optional[Mapping[str, Any]] = None,
    parent_slug: Optional[str] = None,
) -> tuple[MirrorNetworkPublicPayload, MirrorNetworkPrivatePayload]:
    """Build validated public + private payloads from a curiosity bundle."""
    public_curiosity: Dict[str, Any] = {
        "coreCuriosity": curiosity_bundle.get("coreCuriosity"),
        "curiosityContext": curiosity_bundle.get("curiosityContext"),
        "landingContext": curiosity_bundle.get("landingContext"),
        "hooks": curiosity_bundle.get("hooks"),
        "seedQuestions": curiosity_bundle.get("seedQuestions"),
        "discoverySignals": curiosity_bundle.get("discoverySignals"),
        "collectionTags": curiosity_bundle.get("collectionTags"),
        "seed": curiosity_bundle.get("seed"),
        "shareVoice": curiosity_bundle.get("shareVoice"),
    }

    public_payload = build_public_payload_from_curiosity(
        slug=slug,
        card_title=card_title,
        card_date=card_date,
        scene_image_url=scene_image_url,
        curiosity_public=public_curiosity,
        parent_slug=parent_slug,
    )

    private_curiosity: Dict[str, Any] = {
        "mirrorBody": (intelligence_private or {}).get("mirrorBody") or (intelligence_private or {}).get("body"),
        "topicSummary": (intelligence_private or {}).get("topicSummary"),
        "evidenceLabels": (intelligence_private or {}).get("evidenceLabels") or [],
        "intelligenceBrief": intelligence_private,
        "behavioralSnapshot": (intelligence_private or {}).get("behavioralSnapshot"),
        "curiosityPipeline": curiosity_bundle,
    }

    private_payload = build_private_payload(
        user_id=user_id,
        conversation_id=conversation_id,
        curiosity_private=private_curiosity,
    )

    audit = audit_public_payload(public_payload)
    if not audit.passed:
        raise ValueError(
            f"public_payload_audit_failed: keys={audit.forbiddenKeysFound} patterns={audit.forbiddenValuePatternsFound}"
        )

    return public_payload, private_payload
