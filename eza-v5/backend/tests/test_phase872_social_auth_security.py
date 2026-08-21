# -*- coding: utf-8 -*-
"""Phase 8.7.2 — social auth security closure tests."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from jose.exceptions import JWTError
from sqlalchemy.exc import IntegrityError

from backend.services.social_auth import (
    ACCOUNT_LINK_REQUIRED_MESSAGE,
    SocialAuthError,
    VerifiedProviderIdentity,
    consume_apple_auth_attempt,
    create_apple_auth_attempt,
    discard_apple_auth_attempt,
    hash_apple_nonce,
    resolve_safe_auth_return_path,
    resolve_social_user,
    verify_apple_id_token,
)
from backend.services.mirror_network.public_identity import (
    PUBLIC_DISPLAY_NAME_FALLBACK,
    resolve_public_display_name,
)


def _settings(**kwargs):
    base = {
        "GOOGLE_OAUTH_CLIENT_ID": "google-client",
        "APPLE_CLIENT_ID": "com.ezacore.web",
        "APPLE_TEAM_ID": "",
        "APPLE_KEY_ID": "",
        "APPLE_PRIVATE_KEY": "",
        "APPLE_REDIRECT_URI": "https://standalone.ezacore.ai/platform/login",
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _clear_jwks_cache():
    from backend.services import social_auth as sa

    sa._jwks_cache.clear()
    yield
    sa._jwks_cache.clear()


class _FakeAuthIdentity:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def _db_identity_then_email(identity_row=None, email_user=None):
    mock_db = AsyncMock()

    def _scalar(value):
        return SimpleNamespace(scalar_one_or_none=lambda: value)

    # order: identity lookup, then email lookup (when no identity)
    side = [_scalar(identity_row)]
    if identity_row is None:
        side.append(_scalar(email_user))
    mock_db.execute = AsyncMock(side_effect=side)
    mock_db.get = AsyncMock(return_value=None)
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.add = MagicMock()
    return mock_db


def test_provider_sub_existing_same_user():
    user_id = uuid4()
    user = SimpleNamespace(id=user_id, email="a@b.com", is_active=True, public_display_name=None)
    link = SimpleNamespace(user_id=user_id, provider="google", provider_subject="g-sub")
    db = _db_identity_then_email(identity_row=link)
    db.get = AsyncMock(return_value=user)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-sub",
        email="changed@evil.com",
        email_verified=True,
        name_hint="X",
    )
    resolved = asyncio.run(resolve_social_user(db, identity))
    assert resolved.id == user_id
    assert resolved.email == "a@b.com"  # email change ignored for ownership


def test_no_email_user_creates_social_only_with_null_public_name():
    created = SimpleNamespace(
        id=uuid4(),
        email="new@example.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_identity_then_email(identity_row=None, email_user=None)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-new",
        email="new@example.com",
        email_verified=True,
        name_hint="Should Not Publish",
    )
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(return_value=created),
    ) as create_mock, patch(
        "backend.services.social_auth._make_auth_identity",
        side_effect=lambda **kw: _FakeAuthIdentity(**kw),
    ):
        user = asyncio.run(resolve_social_user(db, identity))
    assert user.id == created.id
    assert create_mock.await_args.kwargs.get("public_display_name") is None
    assert create_mock.await_args.kwargs.get("commit") is False
    assert resolve_public_display_name(user) == PUBLIC_DISPLAY_NAME_FALLBACK


def test_existing_local_email_google_conflict_no_auto_link():
    existing = SimpleNamespace(
        id=uuid4(),
        email="omer@example.com",
        is_active=True,
        password_hash="hash",
        public_display_name="Ömer",
    )
    db = _db_identity_then_email(identity_row=None, email_user=existing)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="attacker-google-sub",
        email="omer@example.com",
        email_verified=True,
        name_hint="Attacker",
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(resolve_social_user(db, identity))
    assert exc.value.code == "account_link_required"
    assert exc.value.http_status == 409
    assert "mevcut bir biligN hesabı" in exc.value.message
    db.add.assert_not_called()


def test_existing_local_email_apple_conflict_no_auto_link():
    existing = SimpleNamespace(
        id=uuid4(),
        email="omer@example.com",
        is_active=True,
        password_hash="hash",
        public_display_name=None,
    )
    db = _db_identity_then_email(identity_row=None, email_user=existing)
    identity = VerifiedProviderIdentity(
        provider="apple",
        subject="apple-sub",
        email="omer@example.com",
        email_verified=True,
        name_hint=None,
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(resolve_social_user(db, identity))
    assert exc.value.code == "account_link_required"
    assert exc.value.http_status == 409


def test_google_then_apple_same_email_no_silent_merge():
    google_user = SimpleNamespace(
        id=uuid4(),
        email="same@example.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_identity_then_email(identity_row=None, email_user=google_user)
    identity = VerifiedProviderIdentity(
        provider="apple",
        subject="apple-new-sub",
        email="same@example.com",
        email_verified=True,
        name_hint=None,
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(resolve_social_user(db, identity))
    assert exc.value.code == "account_link_required"


def test_apple_then_google_same_email_no_silent_merge():
    apple_user = SimpleNamespace(
        id=uuid4(),
        email="same@example.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_identity_then_email(identity_row=None, email_user=apple_user)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="google-new-sub",
        email="same@example.com",
        email_verified=True,
        name_hint=None,
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(resolve_social_user(db, identity))
    assert exc.value.code == "account_link_required"


def test_integrity_error_resolves_idempotently():
    user_id = uuid4()
    user = SimpleNamespace(id=user_id, email="race@example.com", is_active=True)
    link = SimpleNamespace(user_id=user_id, provider="google", provider_subject="g-race")

    mock_db = AsyncMock()
    empty = SimpleNamespace(scalar_one_or_none=lambda: None)
    linked = SimpleNamespace(scalar_one_or_none=lambda: link)
    # 1 identity miss, 2 email miss, then after IntegrityError: identity hit
    mock_db.execute = AsyncMock(side_effect=[empty, empty, linked])
    mock_db.get = AsyncMock(return_value=user)
    mock_db.commit = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("dup")))
    mock_db.rollback = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()

    created = SimpleNamespace(id=uuid4(), email="race@example.com", is_active=True)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-race",
        email="race@example.com",
        email_verified=True,
        name_hint=None,
    )
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(return_value=created),
    ), patch(
        "backend.services.social_auth._make_auth_identity",
        side_effect=lambda **kw: _FakeAuthIdentity(**kw),
    ):
        resolved = asyncio.run(resolve_social_user(mock_db, identity))
    assert resolved.id == user_id
    mock_db.rollback.assert_awaited()


def test_apple_nonce_required_missing_hash():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_apple_id_token("token", expected_nonce_hash=""))
        assert exc.value.code == "invalid_nonce"


def test_apple_nonce_mismatch_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        return_value={"sub": "a", "email": "a@b.com", "nonce": "wrong"},
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token("token", expected_nonce_hash=hash_apple_nonce("raw"))
            )
        assert exc.value.code == "invalid_nonce"


def test_apple_valid_nonce_hash_succeeds():
    raw = "server-nonce"
    expected = hash_apple_nonce(raw)
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        return_value={
            "sub": "apple-sub",
            "email": "relay@privaterelay.appleid.com",
            "nonce": expected,
        },
    ):
        identity = asyncio.run(
            verify_apple_id_token("token", expected_nonce_hash=expected)
        )
    assert identity.subject == "apple-sub"
    assert identity.email == "relay@privaterelay.appleid.com"


def test_safe_return_path_rejects_open_redirect():
    assert resolve_safe_auth_return_path("https://evil.com") is None
    assert resolve_safe_auth_return_path("//evil.com") is None
    assert resolve_safe_auth_return_path("/\\evil") is None
    assert resolve_safe_auth_return_path("/m/abc/sohbet") == "/m/abc/sohbet"
    assert resolve_safe_auth_return_path("/standalone/discover") == "/standalone/discover"
    assert resolve_safe_auth_return_path("/admin") is None


def test_create_apple_attempt_binds_safe_return_only():
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.add = MagicMock()

    class FakeAttempt:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(),
    ), patch(
        "backend.services.social_auth._make_apple_attempt",
        side_effect=lambda **kw: FakeAttempt(**kw),
    ):
        payload = asyncio.run(
            create_apple_auth_attempt(mock_db, return_path="https://evil.example/phish")
        )
    assert payload["state"]
    assert payload["nonce"]
    assert payload["state"] != payload["nonce"]
    attempt = mock_db.add.call_args[0][0]
    assert attempt.return_path is None  # unsafe stripped
    assert attempt.nonce_hash == hash_apple_nonce(payload["nonce"])
    assert attempt.consumed_at is None


def test_consume_apple_attempt_single_use_and_replay():
    now = datetime.now(timezone.utc)
    attempt = SimpleNamespace(
        provider="apple",
        state="s1",
        nonce_hash=hash_apple_nonce("n1"),
        expires_at=now + timedelta(minutes=5),
        consumed_at=None,
    )
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: attempt)
    )
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    first = asyncio.run(consume_apple_auth_attempt(mock_db, "s1"))
    assert first.consumed_at is not None

    # replay
    attempt.consumed_at = now
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(consume_apple_auth_attempt(mock_db, "s1"))
    assert exc.value.code == "invalid_state"


def test_consume_missing_expired_state():
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: None)
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(consume_apple_auth_attempt(mock_db, "unknown"))
    assert exc.value.code == "invalid_state"

    now = datetime.now(timezone.utc)
    expired = SimpleNamespace(
        provider="apple",
        state="old",
        nonce_hash="x",
        expires_at=now - timedelta(minutes=1),
        consumed_at=None,
    )
    mock_db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: expired)
    )
    with pytest.raises(SocialAuthError) as exc2:
        asyncio.run(consume_apple_auth_attempt(mock_db, "old"))
    assert exc2.value.code == "invalid_state"


def test_discard_apple_attempt_on_cancel():
    attempt = SimpleNamespace(consumed_at=None)
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: attempt)
    )
    mock_db.commit = AsyncMock()
    asyncio.run(discard_apple_auth_attempt(mock_db, "s1"))
    assert attempt.consumed_at is not None


def test_relay_not_public_and_account_link_message_stable():
    assert "biligN" in ACCOUNT_LINK_REQUIRED_MESSAGE
    user = SimpleNamespace(
        email="xyz@privaterelay.appleid.com", public_display_name=None
    )
    assert resolve_public_display_name(user) == PUBLIC_DISPLAY_NAME_FALLBACK
    assert "xyz" not in resolve_public_display_name(user)


def test_apple_invalid_token_still_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("bad"),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token("t", expected_nonce_hash=hash_apple_nonce("n"))
            )
        assert exc.value.code == "invalid_token"
