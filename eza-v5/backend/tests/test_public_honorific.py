# -*- coding: utf-8 -*-
"""Public honorific (Meraklı / Bilgin) — not a plan, role, or Yansı title."""

from __future__ import annotations

import inspect
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.routers.production_auth import (
    AuthMeResponse,
    PublicIdentityUpdateRequest,
)
from backend.scripts.assign_public_honorific import main as assign_honorific_main
from backend.services.mirror_network.discover import (
    _newest_sort_key,
    _order_eligible,
    _to_discover_item,
    load_discover_eligible_roots,
    random_discover_sort_key,
)
from backend.services.mirror_network.public_identity import (
    PUBLIC_HONORIFIC_BILGIN,
    PUBLIC_HONORIFIC_CURIOUS,
    PUBLIC_HONORIFIC_LABELS,
    assign_public_honorific,
    normalize_public_honorific,
    resolve_public_honorific,
    resolve_public_honorific_label,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_user_mapper_does_not_require_unmigrated_honorific_column():
    """Login/register SELECT User must not 500 when production has not migrated yet."""
    from backend.models.production import User, production_users_safe_load
    from backend.routers.production_auth import login
    from backend.services.production_auth import _AUTH_USER_SQL, authenticate_user

    assert "public_honorific" not in {column.key for column in User.__table__.columns}
    load_call = inspect.getsource(production_users_safe_load).split("return load_only", 1)[1]
    assert "public_honorific" not in load_call
    sql = str(_AUTH_USER_SQL)
    assert "production_users" in sql
    assert "public_honorific" not in sql
    assert "load_user_for_auth" in inspect.getsource(authenticate_user)
    assert "select(User)" not in inspect.getsource(login)
    from backend.routers.production_auth import get_auth_me, patch_public_identity
    from backend.services.production_auth import (
        _SESSION_USER_SQLS,
        _UPDATE_DISPLAY_NAME_SQL,
        load_user_for_auth,
        load_user_session_row,
    )

    assert "id=row[\"id\"]" in inspect.getsource(load_user_for_auth)
    me_src = inspect.getsource(get_auth_me)
    assert "load_user_session_row" in me_src
    assert "select(User)" not in me_src
    for sql in _SESSION_USER_SQLS:
        assert "public_honorific" not in str(sql)
    patch_src = inspect.getsource(patch_public_identity)
    assert "update_public_display_name" in patch_src
    assert "db.refresh" not in patch_src
    assert "public_honorific" not in str(_UPDATE_DISPLAY_NAME_SQL)


def test_honorific_default_is_curious_without_migration_backfill():
    assert normalize_public_honorific(None) == PUBLIC_HONORIFIC_CURIOUS
    assert normalize_public_honorific("") == PUBLIC_HONORIFIC_CURIOUS
    assert normalize_public_honorific("premium") == PUBLIC_HONORIFIC_CURIOUS
    assert normalize_public_honorific("user") == PUBLIC_HONORIFIC_CURIOUS
    assert resolve_public_honorific(None) == PUBLIC_HONORIFIC_CURIOUS
    assert resolve_public_honorific(SimpleNamespace()) == PUBLIC_HONORIFIC_CURIOUS
    assert resolve_public_honorific_label(SimpleNamespace(public_honorific=None)) == "Meraklı"


def test_honorific_bilgin_is_explicit_only():
    user = SimpleNamespace(public_honorific=PUBLIC_HONORIFIC_BILGIN)
    assert resolve_public_honorific(user) == PUBLIC_HONORIFIC_BILGIN
    assert resolve_public_honorific_label(user) == "Bilgin"


def test_honorific_not_derived_from_plan_or_role():
    user = SimpleNamespace(
        public_honorific=None,
        role="admin",
        mirror_plan="plus",
        account_tier="premium",
        email="ada@example.com",
    )
    assert resolve_public_honorific(user) == PUBLIC_HONORIFIC_CURIOUS
    assert resolve_public_honorific_label(user) == PUBLIC_HONORIFIC_LABELS[
        PUBLIC_HONORIFIC_CURIOUS
    ]


def test_system_assign_public_honorific_rejects_unknown():
    user = SimpleNamespace(id=uuid4(), public_honorific=None)
    with pytest.raises(ValueError, match="invalid_public_honorific"):
        assign_public_honorific(user, "premium")
    assert user.public_honorific is None
    assert assign_public_honorific(user, "bilgin") == PUBLIC_HONORIFIC_BILGIN
    assert user.public_honorific == PUBLIC_HONORIFIC_BILGIN
    assert assign_public_honorific(user, "curious") == PUBLIC_HONORIFIC_CURIOUS
    assert user.public_honorific == PUBLIC_HONORIFIC_CURIOUS


def test_assign_public_honorific_logs_ids_not_email(caplog):
    user = SimpleNamespace(id=uuid4(), public_honorific=None, email="secret@example.com")
    with caplog.at_level("INFO"):
        assign_public_honorific(user, "bilgin", actor="operator_cli")
    joined = " ".join(record.getMessage() for record in caplog.records)
    assert "public_honorific_changed" in joined
    assert "from=curious" in joined
    assert "to=bilgin" in joined
    assert str(user.id) in joined
    assert "secret@example.com" not in joined
    assert "Ada" not in joined


def test_owner_patch_rejects_honorific_extra():
    assert "public_honorific" not in PublicIdentityUpdateRequest.model_fields
    with pytest.raises(ValidationError):
        PublicIdentityUpdateRequest.model_validate(
            {"public_display_name": "Ada Lovelace", "public_honorific": "bilgin"}
        )
    with pytest.raises(ValidationError):
        PublicIdentityUpdateRequest.model_validate(
            {"public_display_name": "Ada Lovelace", "publicHonorific": "bilgin"}
        )
    parsed = PublicIdentityUpdateRequest.model_validate(
        {"public_display_name": "Ada Lovelace"}
    )
    assert parsed.public_display_name == "Ada Lovelace"


def test_auth_me_honorific_is_enum_not_plan():
    payload = AuthMeResponse(
        user_id="u1",
        email="ada@example.com",
        role="user",
        mirror_plan="plus",
        account_tier="premium",
        public_display_name="Ada",
        public_honorific=PUBLIC_HONORIFIC_CURIOUS,
    )
    dumped = payload.model_dump()
    assert dumped["public_honorific"] == PUBLIC_HONORIFIC_CURIOUS
    assert dumped["account_tier"] == "premium"
    assert dumped["public_honorific"] != dumped["account_tier"]
    assert dumped["public_honorific"] != dumped["role"]


def test_assign_cli_rejects_invalid_user_id():
    assert assign_honorific_main(["--user-id", "not-a-uuid", "--honorific", "bilgin"]) == 2


def test_no_http_router_assigns_honorific():
    auth = (BACKEND_ROOT / "routers" / "production_auth.py").read_text(encoding="utf-8")
    network = (BACKEND_ROOT / "routers" / "mirror_network.py").read_text(encoding="utf-8")
    assert "assign_public_honorific" not in auth
    assert "assign_public_honorific" not in network


def test_discover_item_can_carry_display_honorific_without_user_id():
    node = SimpleNamespace(
        slug="root-a",
        card_title="Taşlar",
        public_payload={"publicTitle": "Taşlar"},
        published_at=None,
        journey_version=1,
    )
    item = _to_discover_item(
        node,
        scene_url="https://cdn.example/a.png",
        yansi_count=0,
        author_display_name="Mert Karaca",
        public_honorific="bilgin",
    )
    dumped = item.model_dump()
    assert dumped["authorDisplayName"] == "Mert Karaca"
    assert dumped["publicHonorific"] == "bilgin"
    assert "userId" not in dumped
    assert "email" not in dumped
    assert "account_tier" not in dumped
    assert "mirror_plan" not in dumped


def test_honorific_absent_from_discover_ordering_and_ranking():
    order_src = "\n".join(
        [
            inspect.getsource(_order_eligible),
            inspect.getsource(random_discover_sort_key),
            inspect.getsource(_newest_sort_key),
            inspect.getsource(load_discover_eligible_roots),
        ]
    )
    assert "honorific" not in order_src.lower()
    assert "public_honorific" not in order_src
    sc_dir = BACKEND_ROOT / "services" / "mirror_network"
    joined = "\n".join(
        path.read_text(encoding="utf-8") for path in sc_dir.glob("*strong_curiosity*")
    )
    assert "public_honorific" not in joined
    assert "publicHonorific" not in joined
    metrics = (sc_dir / "yansi_metrics.py").read_text(encoding="utf-8")
    assert "public_honorific" not in metrics
    assert "publicHonorific" not in metrics
