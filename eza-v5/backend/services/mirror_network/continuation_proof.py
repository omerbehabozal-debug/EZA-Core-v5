# -*- coding: utf-8 -*-
"""Server-verified lineage proofs for mirror continuation (Faz 2.2+)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_continuation_proof import MirrorContinuationProof
from backend.services.mirror_network.parent_lineage import validate_parent_slug

PROOF_TTL_HOURS = 72

_PROOF_FORBIDDEN_RESPONSE_KEYS = frozenset(
    {
        "actor_hash",
        "guest_token_hash",
        "guestToken",
        "session_id",
        "sessionId",
        "user_id",
        "userId",
    }
)


def _bad_proof(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": code, "message": message},
    )


def _conflict_proof(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": code, "message": message},
    )


def guest_token_fingerprint(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:32]


def actor_hash_for_guest_token(guest_token: str | None) -> str:
    token = (guest_token or "").strip()
    if not token:
        raise ValueError("guest_token_required")
    return guest_token_fingerprint(token)


async def create_continuation_proof(
    db: AsyncSession,
    *,
    source_mirror_slug: str,
    session_id: str,
    guest_token: str,
) -> MirrorContinuationProof:
    now = datetime.now(timezone.utc)
    proof = MirrorContinuationProof(
        id=uuid4(),
        source_mirror_slug=source_mirror_slug.strip().lower(),
        session_id=session_id.strip(),
        actor_hash=actor_hash_for_guest_token(guest_token),
        expires_at=now + timedelta(hours=PROOF_TTL_HOURS),
    )
    db.add(proof)
    await db.commit()
    await db.refresh(proof)
    return proof


async def get_continuation_proof_by_id(
    db: AsyncSession,
    proof_id: UUID,
) -> Optional[MirrorContinuationProof]:
    result = await db.execute(
        select(MirrorContinuationProof).where(MirrorContinuationProof.id == proof_id)
    )
    return result.scalar_one_or_none()


def _actor_matches(
    proof: MirrorContinuationProof,
    *,
    user_id: UUID,
    guest_token: str | None,
) -> bool:
    if proof.user_id and proof.user_id == user_id:
        return True
    if guest_token:
        try:
            return proof.actor_hash == actor_hash_for_guest_token(guest_token)
        except ValueError:
            return False
    return False


def _proof_expired(proof: MirrorContinuationProof, *, now: datetime) -> bool:
    expires_at = proof.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < now


async def atomically_consume_continuation_proof(
    db: AsyncSession,
    *,
    proof_id: UUID,
    user_id: UUID,
    conversation_id: str | None,
) -> Optional[MirrorContinuationProof]:
    """Single-winner consume — only one publish may mark a proof consumed."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(MirrorContinuationProof)
        .where(
            MirrorContinuationProof.id == proof_id,
            MirrorContinuationProof.consumed_at.is_(None),
            MirrorContinuationProof.expires_at > now,
        )
        .values(
            consumed_at=now,
            conversation_id=conversation_id,
            user_id=user_id,
        )
        .returning(MirrorContinuationProof)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def resolve_parent_slug_from_proof(
    db: AsyncSession,
    *,
    proof_token: str | None,
    user_id: UUID,
    guest_token: str | None,
    conversation_id: str | None,
    child_slug: str,
    consume: bool,
) -> Optional[str]:
    """
    Validate a server-issued proof and return the parent slug.

    When consume=True, atomically binds conversation_id and marks proof consumed.
    """
    normalized_token = (proof_token or "").strip()
    if not normalized_token:
        return None

    try:
        proof_id = UUID(normalized_token)
    except ValueError as exc:
        raise _bad_proof("lineage_proof_invalid", "lineageProofToken is invalid") from exc

    proof = await get_continuation_proof_by_id(db, proof_id)
    if not proof:
        raise _bad_proof("lineage_proof_invalid", "lineageProofToken is invalid")

    now = datetime.now(timezone.utc)
    if _proof_expired(proof, now=now):
        raise _bad_proof("lineage_proof_expired", "lineageProofToken has expired")

    if not _actor_matches(proof, user_id=user_id, guest_token=guest_token):
        raise _bad_proof("lineage_proof_forbidden", "lineageProofToken actor mismatch")

    normalized_conversation_id = (conversation_id or "").strip() or None

    if proof.consumed_at:
        if proof.conversation_id and normalized_conversation_id == proof.conversation_id:
            return proof.source_mirror_slug
        raise _conflict_proof("lineage_proof_consumed", "lineageProofToken already used")

    parent_slug = await validate_parent_slug(
        db,
        parent_slug=proof.source_mirror_slug,
        child_slug=child_slug,
    )

    if not consume:
        return parent_slug

    consumed = await atomically_consume_continuation_proof(
        db,
        proof_id=proof_id,
        user_id=user_id,
        conversation_id=normalized_conversation_id,
    )
    if consumed is not None:
        await db.commit()
        return parent_slug

    raced = await get_continuation_proof_by_id(db, proof_id)
    if not raced:
        raise _bad_proof("lineage_proof_invalid", "lineageProofToken is invalid")
    if _proof_expired(raced, now=now):
        raise _bad_proof("lineage_proof_expired", "lineageProofToken has expired")
    if raced.consumed_at and raced.conversation_id == normalized_conversation_id:
        return raced.source_mirror_slug
    raise _conflict_proof("lineage_proof_consumed", "lineageProofToken already used")


async def count_verified_continuation_starts(db: AsyncSession, mirror_slug: str) -> int:
    normalized = (mirror_slug or "").strip().lower()
    if not normalized:
        return 0
    result = await db.execute(
        select(func.count(func.distinct(MirrorContinuationProof.actor_hash))).where(
            MirrorContinuationProof.source_mirror_slug == normalized,
        )
    )
    return int(result.scalar() or 0)


def assert_proof_response_safe(payload: dict) -> None:
    leaked = _PROOF_FORBIDDEN_RESPONSE_KEYS.intersection(payload.keys())
    if leaked:
        raise RuntimeError(f"proof_response_privacy_violation:{','.join(sorted(leaked))}")
