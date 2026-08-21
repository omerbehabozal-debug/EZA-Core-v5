# -*- coding: utf-8 -*-
"""Phase 8.7.1 / 8.7.2 — Google / Apple social auth verification + user resolve.

Provider `sub` is the durable identity. Email is never automatic ownership proof
of an existing biligN account (Phase 8.7.2). Apple state/nonce are server-bound.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

import httpx
from fastapi import HTTPException
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.production import SocialAuthAttempt, User, UserAuthIdentity
from backend.services.production_auth import (
    create_access_token,
    create_user,
    normalize_email,
)

logger = logging.getLogger(__name__)

ProviderName = Literal["google", "apple"]

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

APPLE_ATTEMPT_TTL_SECONDS = 600
ACCOUNT_LINK_REQUIRED_MESSAGE = (
    "Bu e-posta ile mevcut bir biligN hesabı var. Önce mevcut hesabınla giriş yap."
)


@dataclass(frozen=True)
class VerifiedProviderIdentity:
    provider: ProviderName
    subject: str
    email: str | None
    email_verified: bool
    name_hint: str | None


class SocialAuthError(Exception):
    def __init__(self, code: str, message: str, http_status: int = 401):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


def google_oauth_configured() -> bool:
    return bool((get_settings().GOOGLE_OAUTH_CLIENT_ID or "").strip())


def apple_oauth_configured() -> bool:
    """Future code-exchange readiness (not required for current id_token path)."""
    s = get_settings()
    return bool(
        (s.APPLE_CLIENT_ID or "").strip()
        and (s.APPLE_TEAM_ID or "").strip()
        and (s.APPLE_KEY_ID or "").strip()
        and (s.APPLE_PRIVATE_KEY or "").strip()
    )


def apple_id_token_verify_configured() -> bool:
    """Apple popup id_token verify needs Services ID + registered redirect URI."""
    s = get_settings()
    return bool(
        (s.APPLE_CLIENT_ID or "").strip() and (s.APPLE_REDIRECT_URI or "").strip()
    )


def _raise_http(err: SocialAuthError) -> None:
    raise HTTPException(
        status_code=err.http_status,
        detail={"code": err.code, "message": err.message},
    )


def resolve_safe_auth_return_path(return_path: str | None) -> str | None:
    """Server mirror of Phase 8.7 frontend allowlist. None if invalid/absent."""
    if not return_path or not isinstance(return_path, str):
        return None
    path = return_path.strip()
    if not path.startswith("/"):
        return None
    if path.startswith("//"):
        return None
    if "\\" in path:
        return None
    if "://" in path:
        return None
    path_only = (path.split("?")[0].split("#")[0] or "").strip()
    allowed = (
        path_only == "/"
        or path_only.startswith("/standalone")
        or path_only.startswith("/m/")
        or path_only.startswith("/platform")
        or path_only.startswith("/dev/")
    )
    if not allowed:
        return None
    return path


_jwks_cache: dict[str, tuple[float, dict[str, Any]]] = {}


async def _fetch_jwks(url: str) -> dict[str, Any]:
    now = time.time()
    cached = _jwks_cache.get(url)
    if cached and cached[0] > now:
        return cached[1]
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    _jwks_cache[url] = (now + 3600, data)
    return data


def _rsa_key_from_jwk(jwk: dict[str, Any]) -> dict[str, Any]:
    return {
        "kty": jwk.get("kty"),
        "kid": jwk.get("kid"),
        "use": jwk.get("use"),
        "n": jwk.get("n"),
        "e": jwk.get("e"),
        "alg": jwk.get("alg"),
    }


def hash_apple_nonce(raw_nonce: str) -> str:
    return hashlib.sha256(raw_nonce.encode("utf-8")).hexdigest()


async def verify_google_id_token(
    id_token: str,
    *,
    clock_skew_seconds: int = 60,
) -> VerifiedProviderIdentity:
    client_id = (get_settings().GOOGLE_OAUTH_CLIENT_ID or "").strip()
    if not client_id:
        raise SocialAuthError(
            "google_not_configured",
            "Google ile giriş şu an kullanılamıyor.",
            http_status=503,
        )
    token = (id_token or "").strip()
    if not token:
        raise SocialAuthError("invalid_token", "Google kimliği doğrulanamadı.")

    try:
        headers = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise SocialAuthError("invalid_token", "Google kimliği doğrulanamadı.") from exc

    kid = headers.get("kid")
    try:
        jwks = await _fetch_jwks(GOOGLE_CERTS_URL)
    except Exception as exc:
        logger.warning("social_auth_failure provider=google reason=jwks_fetch")
        raise SocialAuthError(
            "provider_unavailable",
            "Google doğrulama servisine ulaşılamadı.",
            http_status=503,
        ) from exc

    keys = jwks.get("keys") or []
    key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        raise SocialAuthError("invalid_token", "Google kimliği doğrulanamadı.")

    try:
        claims = jwt.decode(
            token,
            _rsa_key_from_jwk(key),
            algorithms=["RS256"],
            audience=client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"leeway": clock_skew_seconds},
        )
    except JWTError as exc:
        logger.info("social_auth_failure provider=google reason=invalid_token")
        raise SocialAuthError("invalid_token", "Google kimliği doğrulanamadı.") from exc

    sub = str(claims.get("sub") or "").strip()
    if not sub:
        raise SocialAuthError("invalid_token", "Google kimliği doğrulanamadı.")

    email_raw = claims.get("email")
    email = normalize_email(str(email_raw)) if email_raw else None
    email_verified = bool(claims.get("email_verified"))
    name_hint = None
    for field in ("name", "given_name"):
        cand = claims.get(field)
        if isinstance(cand, str) and cand.strip():
            name_hint = cand.strip()
            break

    return VerifiedProviderIdentity(
        provider="google",
        subject=sub,
        email=email,
        email_verified=email_verified,
        name_hint=name_hint,
    )


async def verify_apple_id_token(
    id_token: str,
    *,
    expected_nonce_hash: str,
    clock_skew_seconds: int = 60,
) -> VerifiedProviderIdentity:
    client_id = (get_settings().APPLE_CLIENT_ID or "").strip()
    if not client_id:
        raise SocialAuthError(
            "apple_not_configured",
            "Apple ile giriş şu an kullanılamıyor.",
            http_status=503,
        )
    token = (id_token or "").strip()
    if not token:
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.")

    expected = (expected_nonce_hash or "").strip()
    if not expected:
        raise SocialAuthError("invalid_nonce", "Apple oturumu doğrulanamadı.")

    try:
        headers = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.") from exc

    kid = headers.get("kid")
    try:
        jwks = await _fetch_jwks(APPLE_KEYS_URL)
    except Exception as exc:
        logger.warning("social_auth_failure provider=apple reason=jwks_fetch")
        raise SocialAuthError(
            "provider_unavailable",
            "Apple doğrulama servisine ulaşılamadı.",
            http_status=503,
        ) from exc

    keys = jwks.get("keys") or []
    key = next((k for k in keys if k.get("kid") == kid), None)
    if key is None:
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.")

    try:
        claims = jwt.decode(
            token,
            _rsa_key_from_jwk(key),
            algorithms=["RS256"],
            audience=client_id,
            issuer=APPLE_ISSUER,
            options={"leeway": clock_skew_seconds},
        )
    except JWTError as exc:
        logger.info("social_auth_failure provider=apple reason=invalid_token")
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.") from exc

    claim_nonce = str(claims.get("nonce") or "").strip()
    if claim_nonce != expected:
        raise SocialAuthError("invalid_nonce", "Apple oturumu doğrulanamadı.")

    sub = str(claims.get("sub") or "").strip()
    if not sub:
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.")

    email_raw = claims.get("email")
    email = normalize_email(str(email_raw)) if email_raw else None
    email_verified = bool(claims.get("email_verified", True)) if email else False

    return VerifiedProviderIdentity(
        provider="apple",
        subject=sub,
        email=email,
        email_verified=email_verified,
        name_hint=None,
    )


def _make_apple_attempt(**kwargs) -> SocialAuthAttempt:
    """Factory — tests may mock to avoid full SQLAlchemy mapper init."""
    return SocialAuthAttempt(**kwargs)


async def create_apple_auth_attempt(
    db: AsyncSession,
    *,
    return_path: str | None = None,
) -> dict[str, str]:
    """Server-authoritative Apple attempt: unpredictable state + raw nonce."""
    if not apple_id_token_verify_configured():
        raise SocialAuthError(
            "apple_not_configured",
            "Apple ile giriş şu an kullanılamıyor.",
            http_status=503,
        )
    settings = get_settings()
    state = secrets.token_urlsafe(32)
    raw_nonce = secrets.token_urlsafe(32)
    nonce_hash = hash_apple_nonce(raw_nonce)
    safe_return = resolve_safe_auth_return_path(return_path)
    now = datetime.now(timezone.utc)
    attempt = _make_apple_attempt(
        id=uuid4(),
        provider="apple",
        state=state,
        nonce_hash=nonce_hash,
        return_path=safe_return,
        expires_at=now + timedelta(seconds=APPLE_ATTEMPT_TTL_SECONDS),
        consumed_at=None,
    )
    db.add(attempt)
    await db.commit()
    return {
        "state": state,
        "nonce": raw_nonce,
        "clientId": (settings.APPLE_CLIENT_ID or "").strip(),
        "redirectUri": (settings.APPLE_REDIRECT_URI or "").strip(),
    }


async def consume_apple_auth_attempt(
    db: AsyncSession,
    state: str,
) -> SocialAuthAttempt:
    """Single-use consume. Rejects missing / unknown / expired / replayed state."""
    token_state = (state or "").strip()
    if not token_state:
        raise SocialAuthError("invalid_state", "Apple oturumu doğrulanamadı.")

    result = await db.execute(
        select(SocialAuthAttempt).where(
            SocialAuthAttempt.provider == "apple",
            SocialAuthAttempt.state == token_state,
        )
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        raise SocialAuthError("invalid_state", "Apple oturumu doğrulanamadı.")

    now = datetime.now(timezone.utc)
    expires = attempt.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if attempt.consumed_at is not None:
        raise SocialAuthError("invalid_state", "Apple oturumu doğrulanamadı.")
    if expires <= now:
        raise SocialAuthError("invalid_state", "Apple oturumu doğrulanamadı.")

    attempt.consumed_at = now
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def discard_apple_auth_attempt(db: AsyncSession, state: str) -> None:
    """Cancellation: mark attempt consumed so it cannot be replayed."""
    token_state = (state or "").strip()
    if not token_state:
        return
    result = await db.execute(
        select(SocialAuthAttempt).where(
            SocialAuthAttempt.provider == "apple",
            SocialAuthAttempt.state == token_state,
        )
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        return
    if attempt.consumed_at is None:
        attempt.consumed_at = datetime.now(timezone.utc)
        await db.commit()


async def _find_identity(
    db: AsyncSession, provider: ProviderName, subject: str
) -> UserAuthIdentity | None:
    result = await db.execute(
        select(UserAuthIdentity).where(
            UserAuthIdentity.provider == provider,
            UserAuthIdentity.provider_subject == subject,
        )
    )
    return result.scalar_one_or_none()


async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == normalize_email(email)))
    return result.scalar_one_or_none()


def _make_auth_identity(
    *,
    user_id,
    provider: ProviderName,
    provider_subject: str,
    email_at_link: str | None,
) -> UserAuthIdentity:
    """Factory — tests may mock this to avoid full SQLAlchemy mapper init."""
    return UserAuthIdentity(
        user_id=user_id,
        provider=provider,
        provider_subject=provider_subject,
        email_at_link=email_at_link,
    )


async def resolve_social_user(
    db: AsyncSession,
    identity: VerifiedProviderIdentity,
    *,
    apple_name_hint: str | None = None,
) -> User:
    """
    Resolve or create biligN user for a verified provider identity.

    Phase 8.7.2 linking policy:
    - Existing (provider, sub) → that user (email changes ignored).
    - Else email matches existing biligN user → account_link_required (409).
      Never auto-link by email alone.
    - Else create social-only user (public_display_name=NULL).
    - IntegrityError on identity/email → rollback, re-fetch by (provider, sub),
      idempotent success when identity now exists.
    """
    _ = apple_name_hint  # API compat; never auto-publish provider name

    existing_link = await _find_identity(db, identity.provider, identity.subject)
    if existing_link:
        user = await db.get(User, existing_link.user_id)
        if user is None or not user.is_active:
            raise SocialAuthError(
                "account_inactive",
                "Hesap bulunamadı veya pasif.",
                http_status=403,
            )
        return user

    email = identity.email
    if not email:
        raise SocialAuthError(
            "email_required",
            "Bu Apple hesabı için e-posta alınamadı. İlk girişte e-posta paylaşımı gerekir.",
            http_status=400,
        )

    existing_email_user = await _find_user_by_email(db, email)
    if existing_email_user is not None:
        raise SocialAuthError(
            "account_link_required",
            ACCOUNT_LINK_REQUIRED_MESSAGE,
            http_status=409,
        )

    try:
        user = await create_user(
            db,
            email=email,
            password=None,
            role="user",
            public_display_name=None,
            commit=False,
        )
        db.add(
            _make_auth_identity(
                user_id=user.id,
                provider=identity.provider,
                provider_subject=identity.subject,
                email_at_link=email,
            )
        )
        await db.commit()
        await db.refresh(user)
        logger.info(
            "social_auth_success provider=%s user_id=%s action=create",
            identity.provider,
            user.id,
        )
        return user
    except ValueError:
        await db.rollback()
        raise SocialAuthError(
            "account_link_required",
            ACCOUNT_LINK_REQUIRED_MESSAGE,
            http_status=409,
        )
    except IntegrityError:
        await db.rollback()
        raced = await _find_identity(db, identity.provider, identity.subject)
        if raced is not None:
            user = await db.get(User, raced.user_id)
            if user is not None and user.is_active:
                logger.info(
                    "social_auth_success provider=%s user_id=%s action=race_idempotent",
                    identity.provider,
                    user.id,
                )
                return user
        raise SocialAuthError(
            "account_link_required",
            ACCOUNT_LINK_REQUIRED_MESSAGE,
            http_status=409,
        )


async def issue_social_token_response(db: AsyncSession, user: User) -> dict[str, Any]:
    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
