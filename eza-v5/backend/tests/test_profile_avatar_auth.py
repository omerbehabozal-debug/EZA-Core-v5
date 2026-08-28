# -*- coding: utf-8 -*-
"""Auth /me avatar endpoints."""

from __future__ import annotations

import inspect

from backend.routers.production_auth import AuthMeResponse, PublicAvatarUpdateResponse


def test_auth_me_response_includes_public_avatar_url():
    fields = AuthMeResponse.model_fields
    assert "public_avatar_url" in fields


def test_avatar_upload_endpoint_exists():
    from backend.routers import production_auth

    src = inspect.getsource(production_auth)
    assert "upload_public_avatar" in src
    assert "/me/avatar" in src
    assert "save_profile_avatar_bytes" in src
    assert PublicAvatarUpdateResponse.model_fields["public_avatar_url"].annotation is str


def test_avatar_delete_endpoint_exists():
    from backend.routers import production_auth

    src = inspect.getsource(production_auth)
    assert "delete_public_avatar" in src
    assert "clear_public_avatar_url" in src
    assert "delete_profile_avatar_files" in src
