# -*- coding: utf-8 -*-
"""Server-authoritative atomic avatar persistence."""

from __future__ import annotations

import inspect

from backend.routers.production_auth import PublicAvatarDeleteResponse, PublicAvatarUpdateResponse
from backend.services import production_auth as production_auth_service


def test_atomic_save_sql_increments_revision():
    src = inspect.getsource(production_auth_service)
    assert "save_public_avatar_authoritative" in src
    assert "public_avatar_revision = COALESCE(public_avatar_revision, 0) + 1" in src
    assert "RETURNING public_avatar_url, public_avatar_revision" in src


def test_atomic_clear_sql_increments_revision():
    src = inspect.getsource(production_auth_service)
    assert "clear_public_avatar_authoritative" in src
    assert "RETURNING public_avatar_revision" in src


def test_upload_response_includes_server_revision():
    fields = PublicAvatarUpdateResponse.model_fields
    assert fields["public_avatar_url"].annotation is str
    assert fields["public_avatar_revision"].annotation is int


def test_delete_response_includes_server_revision():
    fields = PublicAvatarDeleteResponse.model_fields
    assert fields["public_avatar_revision"].annotation is int
