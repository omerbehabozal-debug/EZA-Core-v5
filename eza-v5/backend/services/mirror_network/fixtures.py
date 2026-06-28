# -*- coding: utf-8 -*-
"""QA fixtures for Mirror Network (tests + debug seed)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload, MirrorNetworkPrivatePayload
from backend.services.mirror_network.types import MirrorNetworkNodeRecord
from backend.services.mirror_network.public_payload import split_curiosity_payloads
from backend.services.mirror_network.slug import generate_mirror_slug


JAPAN_FIXTURE_BUNDLE: Dict[str, Any] = {
    "cardTitle": "Sokak Lambaları",
    "coreCuriosity": "Kyoto yağmurdan sonra nasıl bir atmosfer taşır?",
    "curiosityContext": {
        "text": "Bu merak alanı, Japonya'da yürüyerek keşif ve şehir atmosferi üzerine doğmuş bir sohbetten ilham alır.",
    },
    "landingContext": "Bu merak alanı, Japonya'da yürüyerek keşif ve şehir atmosferi üzerine doğmuş bir sohbetten ilham alır.",
    "hooks": ["Kyoto'da bir akşam nasıl yaşanır?"],
    "seedQuestions": ["Kyoto'da sadece bir akşamım olsa nasıl bir rota izlemeliyim?"],
    "discoverySignals": ["travel", "discovery", "Kyoto"],
    "collectionTags": ["travel", "discovery"],
    "seed": {
        "topicCategory": "travel",
        "mood": "discovery",
        "subtopics": ["Japonya seyahati"],
        "curiosityHooks": ["Kyoto'da bir akşam nasıl yaşanır?"],
        "seedQuestions": ["Kyoto'da sadece bir akşamım olsa nasıl bir rota izlemeliyim?"],
        "locale": "tr",
        "safetyTier": "open",
    },
    "shareVoice": {
        "text": "Bazı şehirler gündüz değil, akşam anlaşılır.",
        "preset": "quiet_editorial_minimal",
    },
}

JAPAN_FIXTURE_INTELLIGENCE_PRIVATE: Dict[str, Any] = {
    "mirrorBody": "Bugün Kyoto sokakları ve yağmur sonrası ışık üzerine konuştun — bu özet asla public olmamalı.",
    "topicSummary": "User discussed Kyoto evening walks and rain reflections with assistant.",
    "evidenceLabels": ["Japonya seyahati", "Kyoto ritmi"],
    "behavioralSnapshot": {"alignment_score": 84, "intent": "explore"},
    "publicTopicHint": "japan travel",
    "visualDirection": "quiet luxury evening street atmosphere",
}


def build_fixture_mirror_node(
    *,
    fixture_id: str = "japan-travel",
    user_id: Optional[UUID] = None,
    conversation_id: str = "qa-conv-japan-travel",
    visibility: str = "public",
    safety_status: str = "open",
    slug_suffix: Optional[str] = None,
) -> MirrorNetworkNodeRecord:
    bundle = dict(JAPAN_FIXTURE_BUNDLE)
    card_title = bundle["cardTitle"]
    slug = generate_mirror_slug(card_title, suffix=slug_suffix or fixture_id.replace("_", "")[:6])

    public_payload, private_payload = split_curiosity_payloads(
        slug=slug,
        card_title=card_title,
        card_date="2026-05-31",
        scene_image_url="https://picsum.photos/seed/mirror-japan-fixture/1080/1350",
        user_id=str(user_id or uuid4()),
        conversation_id=conversation_id,
        curiosity_bundle=bundle,
        intelligence_private=JAPAN_FIXTURE_INTELLIGENCE_PRIVATE,
    )

    now = datetime.now(timezone.utc)
    return MirrorNetworkNodeRecord(
        id=uuid4(),
        slug=slug,
        user_id=user_id or uuid4(),
        conversation_id=conversation_id,
        visibility=visibility,
        safety_status=safety_status,
        card_title=card_title,
        card_date="2026-05-31",
        scene_image_url=public_payload.sceneImageUrl,
        public_payload=public_payload.model_dump(),
        private_payload=private_payload.model_dump(),
        parent_slug=None,
        created_at=now,
        published_at=now,
    )


def fixture_public_payload() -> MirrorNetworkPublicPayload:
    node = build_fixture_mirror_node(slug_suffix="public01")
    return MirrorNetworkPublicPayload.model_validate(node.public_payload)


def fixture_private_payload() -> MirrorNetworkPrivatePayload:
    node = build_fixture_mirror_node(slug_suffix="private01")
    return MirrorNetworkPrivatePayload.model_validate(node.private_payload)