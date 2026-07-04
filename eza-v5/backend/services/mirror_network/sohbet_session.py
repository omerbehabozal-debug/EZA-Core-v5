# -*- coding: utf-8 -*-
"""
Stage 2B — sohbet session from public mirror payload only.

Internal name: seed session. UI never exposes "seed".
"""

from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload
from backend.core.schemas.mirror_sohbet import MirrorSohbetSessionResponse, MirrorThoughtCard
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.service import fetch_public_mirror_by_slug

MAX_THOUGHT_CARDS = 3
SESSION_TTL_HOURS = 72

_FORBIDDEN_OPENING_PHRASES = (
    "sohbetten ilham",
    "user said",
    "assistant",
    "kullanıcı",
    "özet",
    "conversation summary",
)


def _normalize_guest_token(token: str | None) -> str:
    cleaned = (token or "").strip()
    if len(cleaned) >= 16:
        return cleaned
    return secrets.token_urlsafe(24)


def derive_curiosity_anchor(
    *,
    curiosity_context: str,
    card_title: str,
    core_curiosity: str,
) -> str:
    """Short safe anchor for opening line — never quotes raw chat."""
    core = (core_curiosity or "").strip().rstrip("?")
    blob = f"{curiosity_context} {core} {card_title}".lower()

    if "kyoto" in blob and ("yağmur" in blob or "akşam" in blob or "sokak" in blob):
        return "Kyoto'nun akşam ritmini keşfetme"

    if core and len(core) <= 72 and "?" not in core:
        return core

    context = (curiosity_context or "").strip()
    for prefix in ("Bu merak alanı, ", "Bu Mirror, ", "Bu Ayna, "):
        if context.lower().startswith(prefix.lower()):
            context = context[len(prefix) :]
    for cut in (" üzerine doğmuş", " etrafında açılır", " — ", " ilham alır"):
        if cut in context:
            context = context.split(cut)[0]
    context = context.strip(" .,")
    if 8 <= len(context) <= 72:
        return context

    title = (card_title or "bu keşif").strip()
    return f"{title} üzerine keşif"


def build_opening_message(anchor: str) -> str:
    safe = anchor.strip().rstrip(".")
    for phrase in _FORBIDDEN_OPENING_PHRASES:
        if phrase in safe.lower():
            safe = "bu merak alanı"
            break
    return (
        f"Bu Ayna, {safe} merakından doğdu.\n\n"
        "Şimdi bu yolculuk senin sorularınla devam ediyor."
    )


def _editorialize_hook(text: str) -> str:
    raw = (text or "").strip().rstrip("?")
    lower = raw.lower()

    if "kyoto" in lower and "akşam" in lower:
        return "Akşam sokaklarını keşfet"
    if "sessiz" in lower or "mahalle" in lower:
        return "Sessiz mahalleleri keşfet"
    if "kafe" in lower or "yerel" in lower:
        return "Yerel kafeleri bul"
    if "rota" in lower or "yürü" in lower:
        return "Akşam yürüyüş rotası öner"
    if "tren" in lower or "şehir" in lower:
        return "Şehri yavaşça oku"

    cleaned = re.sub(r"\bnasıl\b", "", raw, flags=re.I).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.-")
    if not cleaned:
        return raw[:48] if raw else "Merakını derinleştir"
    if len(cleaned) > 48:
        cleaned = cleaned[:45].rstrip() + "…"
    return cleaned[0].upper() + cleaned[1:] if cleaned else "Keşfe devam et"


def build_thought_cards(public: MirrorNetworkPublicPayload) -> List[MirrorThoughtCard]:
    candidates: List[str] = []
    for item in list(public.hooks or []) + list(public.seedQuestions or []):
        label = (item or "").strip()
        if not label:
            continue
        if label not in candidates:
            candidates.append(label)

    cards: List[MirrorThoughtCard] = []
    seen_labels: set[str] = set()
    for i, candidate in enumerate(candidates):
        if len(cards) >= MAX_THOUGHT_CARDS:
            break
        label = _editorialize_hook(candidate)
        key = label.lower()
        if key in seen_labels:
            continue
        seen_labels.add(key)
        cards.append(MirrorThoughtCard(id=f"thought-{i + 1}", label=label))

    return cards


def resolve_mirror_lineage_ids(
    *,
    slug: str,
    parent_slug: str | None,
    lineage_chain: list[str] | None = None,
) -> tuple[str, str]:
    """
    Returns (parentMirrorId, rootMirrorId) as mirror slugs.
    parentMirrorId is the direct parent or self when root.
    rootMirrorId is the chain root or self when no parent.
    """
    normalized = slug.strip().lower()
    parent = (parent_slug or "").strip().lower() or None

    if not parent or parent == normalized:
        return normalized, normalized

    chain = [s.strip().lower() for s in (lineage_chain or []) if s and str(s).strip()]
    if chain:
        return parent, chain[-1]

    return parent, parent


async def resolve_mirror_lineage_from_db(
    db: AsyncSession,
    slug: str,
    parent_slug: str | None,
) -> tuple[str, str]:
    """Walk parent_slug chain to find root mirror id."""
    normalized = slug.strip().lower()
    parent = (parent_slug or "").strip().lower() or None
    if not parent or parent == normalized:
        return normalized, normalized

    root = parent
    current = parent
    visited: set[str] = {normalized}
    for _ in range(16):
        if current in visited:
            break
        visited.add(current)
        root = current
        node = await get_mirror_network_node_by_slug(db, current)
        if not node or not node.parent_slug:
            break
        next_parent = node.parent_slug.strip().lower()
        if not next_parent or next_parent == current:
            break
        current = next_parent

    return parent, root


def resolve_public_scene_image_url(scene_image_url: str | None) -> str | None:
    """Public HTTP(S) scene URLs only — never data:/blob: in guest session."""
    raw = (scene_image_url or "").strip()
    if not raw:
        return None
    lower = raw.lower()
    if lower.startswith(("data:", "blob:")):
        return None
    if raw.startswith(("http://", "https://")):
        return raw
    return None


def build_sohbet_session_response(
    public: MirrorNetworkPublicPayload,
    guest_token: str | None,
    *,
    parent_mirror_id: str | None = None,
    root_mirror_id: str | None = None,
) -> MirrorSohbetSessionResponse:
    token = _normalize_guest_token(guest_token)
    anchor = derive_curiosity_anchor(
        curiosity_context=public.curiosityContext,
        card_title=public.cardTitle,
        core_curiosity=public.coreCuriosity,
    )
    expires = datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
    parent_id, root_id = resolve_mirror_lineage_ids(
        slug=public.slug,
        parent_slug=parent_mirror_id or public.lineage,
    )
    if root_mirror_id:
        root_id = root_mirror_id.strip().lower()

    return MirrorSohbetSessionResponse(
        sessionId=str(uuid.uuid4()),
        guestToken=token,
        mirrorSlug=public.slug,
        cardTitle=public.cardTitle,
        openingMessage=build_opening_message(anchor),
        thoughtCards=build_thought_cards(public),
        expiresAt=expires.isoformat(),
        parentMirrorId=parent_id,
        rootMirrorId=root_id,
        seedTopic=public.cardTitle,
        seedCategory=public.seed.topicCategory,
        seedMood=public.seed.mood,
        lineageProofToken=None,
        sceneImageUrl=resolve_public_scene_image_url(public.sceneImageUrl),
    )


async def create_sohbet_session(
    db: AsyncSession,
    slug: str,
    guest_token: str | None,
) -> MirrorSohbetSessionResponse:
    public = await fetch_public_mirror_by_slug(db, slug)
    node = await get_mirror_network_node_by_slug(db, slug)
    parent_slug = node.parent_slug if node else public.lineage
    parent_id, root_id = await resolve_mirror_lineage_from_db(db, public.slug, parent_slug)
    session = build_sohbet_session_response(
        public,
        guest_token,
        parent_mirror_id=parent_id,
        root_mirror_id=root_id,
    )
    from backend.services.mirror_network.continuation_proof import create_continuation_proof

    proof = await create_continuation_proof(
        db,
        source_mirror_slug=public.slug,
        session_id=session.sessionId,
        guest_token=session.guestToken,
    )
    return session.model_copy(update={"lineageProofToken": str(proof.id)})


def guest_token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:32]
