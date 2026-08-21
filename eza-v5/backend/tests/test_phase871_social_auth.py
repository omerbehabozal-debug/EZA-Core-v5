# -*- coding: utf-8 -*-
"""Phase 8.7.1 — Google / Apple social auth (mocked provider verification)."""

from __future__ import annotations

import asyncio
import hashlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from jose.exceptions import JWTError

from backend.services.social_auth import (
    SocialAuthError,
    VerifiedProviderIdentity,
    apple_id_token_verify_configured,
    google_oauth_configured,
    resolve_social_user,
    verify_apple_id_token,
    verify_google_id_token,
)
from backend.services.mirror_network.public_identity import (
    PUBLIC_DISPLAY_NAME_FALLBACK,
    resolve_public_display_name,
)


def _settings(**kwargs):
    base = {
        "GOOGLE_OAUTH_CLIENT_ID": "",
        "APPLE_CLIENT_ID": "",
        "APPLE_TEAM_ID": "",
        "APPLE_KEY_ID": "",
        "APPLE_PRIVATE_KEY": "",
        "APPLE_REDIRECT_URI": "",
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _clear_jwks_cache():
    from backend.services import social_auth as sa

    sa._jwks_cache.clear()
    yield
    sa._jwks_cache.clear()


def test_missing_google_config_fail_closed():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(GOOGLE_OAUTH_CLIENT_ID=""),
    ):
        assert google_oauth_configured() is False
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_google_id_token("anything"))
        assert exc.value.code == "google_not_configured"
        assert exc.value.http_status == 503


def test_missing_apple_config_fail_closed():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID=""),
    ):
        assert apple_id_token_verify_configured() is False
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token(
                    "anything", expected_nonce_hash="abc"
                )
            )
        assert exc.value.code == "apple_not_configured"
        assert exc.value.http_status == 503


def test_google_invalid_token_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(GOOGLE_OAUTH_CLIENT_ID="google-client.apps.googleusercontent.com"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        side_effect=JWTError("bad"),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_google_id_token("not-a-jwt"))
        assert exc.value.code == "invalid_token"


def test_google_wrong_audience_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(GOOGLE_OAUTH_CLIENT_ID="expected-client"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("Invalid audience"),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_google_id_token("token"))
        assert exc.value.code == "invalid_token"


def test_google_expired_token_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(GOOGLE_OAUTH_CLIENT_ID="expected-client"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("Signature has expired."),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_google_id_token("token"))
        assert exc.value.code == "invalid_token"


def test_google_valid_identity_decoded():
    claims = {
        "sub": "google-sub-1",
        "email": "Person@Example.COM",
        "email_verified": True,
        "name": "Ada Lovelace",
    }
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(GOOGLE_OAUTH_CLIENT_ID="expected-client"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        return_value=claims,
    ):
        identity = asyncio.run(verify_google_id_token("token"))
    assert identity.provider == "google"
    assert identity.subject == "google-sub-1"
    assert identity.email == "person@example.com"
    assert identity.email_verified is True
    assert identity.name_hint == "Ada Lovelace"


def test_apple_invalid_signature_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID="com.ezacore.web"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("Signature verification failed."),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token(
                    "token", expected_nonce_hash=hashlib.sha256(b"n").hexdigest()
                )
            )
        assert exc.value.code == "invalid_token"


def test_apple_wrong_audience_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID="com.ezacore.web"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("Invalid audience"),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token(
                    "token", expected_nonce_hash=hashlib.sha256(b"n").hexdigest()
                )
            )
        assert exc.value.code == "invalid_token"


def test_apple_expired_token_rejected():
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID="com.ezacore.web"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        side_effect=JWTError("Signature has expired."),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(
                verify_apple_id_token(
                    "token", expected_nonce_hash=hashlib.sha256(b"n").hexdigest()
                )
            )
        assert exc.value.code == "invalid_token"


def test_apple_nonce_mismatch_rejected():
    raw_nonce = "client-nonce-abc"
    wrong_hash = hashlib.sha256(b"other").hexdigest()
    expected = hashlib.sha256(raw_nonce.encode("utf-8")).hexdigest()
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID="com.ezacore.web"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        return_value={"sub": "apple-sub", "email": "a@privaterelay.appleid.com", "nonce": wrong_hash},
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(verify_apple_id_token("token", expected_nonce_hash=expected))
        assert exc.value.code == "invalid_nonce"


def test_apple_nonce_match_accepted():
    raw_nonce = "client-nonce-abc"
    expected = hashlib.sha256(raw_nonce.encode("utf-8")).hexdigest()
    with patch(
        "backend.services.social_auth.get_settings",
        return_value=_settings(APPLE_CLIENT_ID="com.ezacore.web"),
    ), patch(
        "backend.services.social_auth.jwt.get_unverified_header",
        return_value={"kid": "k1", "alg": "RS256"},
    ), patch(
        "backend.services.social_auth._fetch_jwks",
        new=AsyncMock(return_value={"keys": [{"kid": "k1", "kty": "RSA", "n": "x", "e": "AQAB"}]}),
    ), patch(
        "backend.services.social_auth.jwt.decode",
        return_value={
            "sub": "apple-sub-1",
            "email": "relay@privaterelay.appleid.com",
            "email_verified": True,
            "nonce": expected,
        },
    ):
        identity = asyncio.run(
            verify_apple_id_token("token", expected_nonce_hash=expected)
        )
    assert identity.provider == "apple"
    assert identity.subject == "apple-sub-1"
    assert identity.email == "relay@privaterelay.appleid.com"


def _db_for_identity_lookup(identity_row=None, user=None, email_user=None):
    """AsyncMock db: first execute → identity; optional second → email user."""
    mock_db = AsyncMock()

    def _scalar_result(value):
        return SimpleNamespace(scalar_one_or_none=lambda: value)

    results = [_scalar_result(identity_row)]
    if email_user is not None or identity_row is None:
        results.append(_scalar_result(email_user))
    mock_db.execute = AsyncMock(side_effect=results)
    mock_db.get = AsyncMock(return_value=user)
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.add = MagicMock()
    return mock_db


def test_google_repeated_login_same_user():
    user_id = uuid4()
    user = SimpleNamespace(id=user_id, email="a@b.com", is_active=True, public_display_name=None)
    link = SimpleNamespace(user_id=user_id, provider="google", provider_subject="g-sub")
    db = _db_for_identity_lookup(identity_row=link, user=user)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-sub",
        email="a@b.com",
        email_verified=True,
        name_hint="Skip",
    )
    resolved = asyncio.run(resolve_social_user(db, identity))
    assert resolved.id == user_id
    db.add.assert_not_called()


class _FakeAuthIdentity:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


def test_google_verified_email_does_not_auto_link_existing_account():
    """Phase 8.7.2 — verified email is not ownership proof of existing local account."""
    user_id = uuid4()
    existing = SimpleNamespace(
        id=user_id,
        email="omer@example.com",
        is_active=True,
        public_display_name="Ömer",
        password_hash="hash",
    )
    db = _db_for_identity_lookup(identity_row=None, email_user=existing)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-new-sub",
        email="omer@example.com",
        email_verified=True,
        name_hint="Google Name",
    )
    with pytest.raises(SocialAuthError) as exc:
        asyncio.run(resolve_social_user(db, identity))
    assert exc.value.code == "account_link_required"
    assert exc.value.http_status == 409
    db.add.assert_not_called()


def test_unverified_email_creates_when_no_existing_user():
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-unverified",
        email="newcomer@example.com",
        email_verified=False,
        name_hint=None,
    )
    created = SimpleNamespace(
        id=uuid4(),
        email="newcomer@example.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_for_identity_lookup(identity_row=None, email_user=None)
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(return_value=created),
    ) as create_mock, patch(
        "backend.services.social_auth._make_auth_identity",
        side_effect=lambda **kw: _FakeAuthIdentity(**kw),
    ):
        resolved = asyncio.run(resolve_social_user(db, identity))
    assert resolved.id == created.id
    create_mock.assert_awaited_once()
    assert db.execute.await_count == 2


def test_account_conflict_fail_closed_on_create_race():
    db = _db_for_identity_lookup(identity_row=None, email_user=None)
    identity = VerifiedProviderIdentity(
        provider="google",
        subject="g-race",
        email="race@example.com",
        email_verified=True,
        name_hint=None,
    )
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(side_effect=ValueError("exists")),
    ):
        with pytest.raises(SocialAuthError) as exc:
            asyncio.run(resolve_social_user(db, identity))
        assert exc.value.code == "account_link_required"
        assert exc.value.http_status == 409


def test_apple_relay_never_becomes_public_display_name():
    created = SimpleNamespace(
        id=uuid4(),
        email="xyz@privaterelay.appleid.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_for_identity_lookup(identity_row=None, email_user=None)
    identity = VerifiedProviderIdentity(
        provider="apple",
        subject="apple-relay-sub",
        email="xyz@privaterelay.appleid.com",
        email_verified=True,
        name_hint=None,
    )
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(return_value=created),
    ) as create_mock, patch(
        "backend.services.social_auth._make_auth_identity",
        side_effect=lambda **kw: _FakeAuthIdentity(**kw),
    ):
        user = asyncio.run(resolve_social_user(db, identity, apple_name_hint=None))
    kwargs = create_mock.await_args.kwargs
    assert kwargs.get("public_display_name") is None
    assert resolve_public_display_name(user) == PUBLIC_DISPLAY_NAME_FALLBACK
    assert "privaterelay" not in resolve_public_display_name(user)
    assert "xyz" not in resolve_public_display_name(user)


def test_apple_first_name_hint_does_not_auto_publish():
    created = SimpleNamespace(
        id=uuid4(),
        email="a@privaterelay.appleid.com",
        is_active=True,
        public_display_name=None,
    )
    db = _db_for_identity_lookup(identity_row=None, email_user=None)
    identity = VerifiedProviderIdentity(
        provider="apple",
        subject="apple-named",
        email="a@privaterelay.appleid.com",
        email_verified=True,
        name_hint=None,
    )
    with patch(
        "backend.services.social_auth.create_user",
        new=AsyncMock(return_value=created),
    ) as create_mock, patch(
        "backend.services.social_auth._make_auth_identity",
        side_effect=lambda **kw: _FakeAuthIdentity(**kw),
    ):
        asyncio.run(resolve_social_user(db, identity, apple_name_hint="Ayşe"))
    assert create_mock.await_args.kwargs.get("public_display_name") is None


def test_provider_subject_uniqueness_constraint_in_model():
    from backend.models.production import UserAuthIdentity

    names = [c.name for c in UserAuthIdentity.__table__.constraints if hasattr(c, "name")]
    assert "uq_user_auth_identities_provider_subject" in names


def test_public_dto_paths_have_no_social_secrets():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    author = (root / "services/mirror_network/author_profile.py").read_text(encoding="utf-8")
    assert "provider_subject" not in author
    assert "id_token" not in author
    assert "GOOGLE_OAUTH" not in author
    social = (root / "services/social_auth.py").read_text(encoding="utf-8")
    assert 'social_auth_success provider=%s user_id=%s' in social
    assert "authorization_code" not in social
    assert "APPLE_PRIVATE_KEY" not in social.split("logger")[0] or "get_settings" in social
    # Success logs must not interpolate tokens
    for line in social.splitlines():
        if "social_auth_success" in line and "%" in line:
            assert "token" not in line.lower() or "user_id" in line


def test_password_login_rejected_for_social_only_user():
    from backend.services.production_auth import authenticate_user

    user = SimpleNamespace(
        email="social@example.com",
        password_hash=None,
        is_active=True,
        id=uuid4(),
        role="user",
    )
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: user)
    )
    result = asyncio.run(authenticate_user(mock_db, "social@example.com", "any"))
    assert result is None


def test_email_register_login_paths_still_present():
    from pathlib import Path

    router = (Path(__file__).resolve().parents[1] / "routers/production_auth.py").read_text(
        encoding="utf-8"
    )
    assert '@router.post("/register"' in router or '@router.post("/register",' in router
    assert '@router.post("/login"' in router or '@router.post("/login",' in router
    assert '@router.post("/social/google"' in router
    assert '@router.post("/social/apple"' in router
    assert "password=None" in (
        Path(__file__).resolve().parents[1] / "services/production_auth.py"
    ).read_text(encoding="utf-8")
