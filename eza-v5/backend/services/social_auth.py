# -*- coding: utf-8 -*-
"""Phase 8.7.1 — Google / Apple social auth verification + user resolve.

Provider `sub` is the durable identity. Email is used only for safe linking when
the provider marks email as verified. Never trusts frontend-supplied identity.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from fastapi import HTTPException
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.production import User, UserAuthIdentity
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


def _optional_public_name(raw: str | None) -> str | None:
    if raw is None or not str(raw).strip():
        return None
    try:
        from backend.services.mirror_network.public_identity import (
            validate_public_display_name,
        )

        return validate_public_display_name(raw)
    except ValueError:
        return None


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
    nonce: str | None = None,
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

    # Apple embeds SHA-256(hex) of the client nonce in the id_token.
    if nonce:
        expected_nonce = hashlib.sha256(nonce.encode("utf-8")).hexdigest()
        claim_nonce = str(claims.get("nonce") or "").strip()
        if claim_nonce != expected_nonce:
            raise SocialAuthError("invalid_nonce", "Apple oturumu doğrulanamadı.")

    sub = str(claims.get("sub") or "").strip()
    if not sub:
        raise SocialAuthError("invalid_token", "Apple kimliği doğrulanamadı.")

    email_raw = claims.get("email")
    email = normalize_email(str(email_raw)) if email_raw else None
    # Apple may omit email_verified; treat presence of email claim as verified for relay.
    email_verified = bool(claims.get("email_verified", True)) if email else False

    return VerifiedProviderIdentity(
        provider="apple",
        subject=sub,
        email=email,
        email_verified=email_verified,
        name_hint=None,  # name only via first-auth user payload
    )


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

    Linking policy:
    - Existing (provider, sub) → that user.
    - Else verified email matches existing user → link identity (safe auto-link).
    - Else create social-only user.
    - Never set public_display_name from email / Apple relay.
    - Name hint applied only on create when validate_public_display_name passes.
    """
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

    linked_user: User | None = None
    if identity.email and identity.email_verified:
        linked_user = await _find_user_by_email(db, identity.email)

    if linked_user is not None:
        if not linked_user.is_active:
            raise SocialAuthError(
                "account_inactive",
                "Hesap bulunamadı veya pasif.",
                http_status=403,
            )
        # Safe link: verified provider email matches existing account email.
        db.add(
            _make_auth_identity(
                user_id=linked_user.id,
                provider=identity.provider,
                provider_subject=identity.subject,
                email_at_link=identity.email,
            )
        )
        await db.commit()
        await db.refresh(linked_user)
        logger.info(
            "social_auth_success provider=%s user_id=%s action=link",
            identity.provider,
            linked_user.id,
        )
        return linked_user

    # Create social-only user. Email required for uniqueness constraint.
    email = identity.email
    if not email:
        # Apple may omit email on later logins — without prior link we cannot create.
        raise SocialAuthError(
            "email_required",
            "Bu Apple hesabı için e-posta alınamadı. İlk girişte e-posta paylaşımı gerekir.",
            http_status=400,
        )

    name_source = apple_name_hint if identity.provider == "apple" else identity.name_hint
    public_name = _optional_public_name(name_source)

    try:
        user = await create_user(
            db,
            email=email,
            password=None,
            role="user",
            public_display_name=public_name,
        )
    except ValueError:
        # Race: email appeared — fail closed rather than takeover.
        raise SocialAuthError(
            "account_conflict",
            "Bu e-posta ile zaten bir hesap var. E-posta ile giriş yapmayı dene.",
            http_status=409,
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


async def issue_social_token_response(db: AsyncSession, user: User) -> dict[str, Any]:
    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
    }
