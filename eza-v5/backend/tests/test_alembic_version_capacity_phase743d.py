# -*- coding: utf-8 -*-
"""Phase 7.4.3d — alembic_version capacity and migration reproducibility."""

from __future__ import annotations

import inspect
import json
import os
import subprocess
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
from sqlalchemy import MetaData, String, Table, Column, create_engine, inspect as sa_inspect, text
from sqlalchemy.engine.url import make_url

from backend.migrations import alembic_version_capacity as capacity_mod
from backend.migrations.alembic_version_capacity import (
    ALEMBIC_DEFAULT_VERSION_NUM_LENGTH,
    ALEMBIC_VERSION_NUM_LENGTH,
    ALEMBIC_VERSION_TABLE,
    HEAD_REVISION,
    PHASE6_TABLES,
    ensure_alembic_version_capacity,
    inspect_alembic_version_capacity,
    load_revision_identifiers,
    revision_length_audit,
)
from backend.scripts import inspect_alembic_version_capacity as inspect_script


BACKEND_DIR = Path(__file__).resolve().parents[1]
LONGEST_REVISION = "add_mirror_journey_identity_pass_closure"
PHASE42_REVISION = "add_mirror_journey_phase42_eza_snapshot"


def _pg_url() -> str | None:
    return os.environ.get("EZA_MIGRATION_TEST_DATABASE_URL") or None


def test_revision_identifier_lengths():
    audit = revision_length_audit()
    assert audit["headRevision"] == HEAD_REVISION
    assert audit["headLength"] == len(HEAD_REVISION) == 25
    assert audit["maxLength"] == 40
    assert audit["longestRevision"] == "add_mirror_journey_identity_pass_closure"
    assert len("add_mirror_journey_identity_pass_closure") == 40
    assert len("add_mirror_journey_phase42_eza_snapshot") == 39
    assert audit["varchar32Insufficient"] is True
    ids = load_revision_identifiers()
    assert HEAD_REVISION in ids
    assert max(len(item) for item in ids) == 40
    assert any(len(item) > ALEMBIC_DEFAULT_VERSION_NUM_LENGTH for item in ids)


def test_alembic_default_version_num_is_varchar_32():
    engine = create_engine("sqlite://")
    metadata = MetaData()
    Table(
        ALEMBIC_VERSION_TABLE,
        metadata,
        Column("version_num", String(32), nullable=False, primary_key=True),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        report = inspect_alembic_version_capacity(connection)
    assert report["versionNumLength"] == 32
    assert report["status"] == "INSUFFICIENT"
    assert report["sufficient"] is False


def test_ensure_creates_varchar_128_and_stores_longest_and_head():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        created = ensure_alembic_version_capacity(connection, apply=True)
        assert created["action"] == "created_varchar_128"
        assert created["applied"] is True
        after = inspect_alembic_version_capacity(connection)
        assert after["sufficient"] is True
        assert after["versionNumLength"] == ALEMBIC_VERSION_NUM_LENGTH
        connection.execute(
            text(f"INSERT INTO alembic_version (version_num) VALUES ('{LONGEST_REVISION}')")
        )
        stored = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert stored == LONGEST_REVISION
        assert len(stored) == 40
        connection.execute(text("DELETE FROM alembic_version"))
        connection.execute(
            text(f"INSERT INTO alembic_version (version_num) VALUES ('{HEAD_REVISION}')")
        )
        head = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert head == HEAD_REVISION


def test_legacy_varchar32_detection_widen_idempotent_skips_app_tables():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE alembic_version ("
                "version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE yansi_experience_events ("
                "id INTEGER PRIMARY KEY, marker VARCHAR(8))"
            )
        )
        connection.execute(
            text("INSERT INTO yansi_experience_events (id, marker) VALUES (1, 'keep')")
        )
        before_tables = set(sa_inspect(connection).get_table_names())
        dry = ensure_alembic_version_capacity(connection, apply=False)
        assert dry["applied"] is False
        assert dry["action"] == "dry_run"
        assert dry["status"] == "INSUFFICIENT"
        first = ensure_alembic_version_capacity(connection, apply=True)
        assert first["applied"] is True
        assert first["action"] == "widened_to_varchar_128"
        assert first["touchedTables"] == ["alembic_version"]
        second = ensure_alembic_version_capacity(connection, apply=True)
        assert second["action"] == "already_sufficient"
        after_tables = set(sa_inspect(connection).get_table_names())
        assert after_tables == before_tables
        marker = connection.execute(
            text("SELECT marker FROM yansi_experience_events WHERE id = 1")
        ).scalar()
        assert marker == "keep"
        connection.execute(
            text(f"INSERT INTO alembic_version (version_num) VALUES ('{LONGEST_REVISION}')")
        )


def test_helper_does_not_stamp_or_rewrite_history():
    src = inspect.getsource(capacity_mod)
    env_src = (BACKEND_DIR / "migrations" / "env.py").read_text(encoding="utf-8")
    assert "alembic stamp" not in src.lower()
    assert ".stamp(" not in src
    assert "downgrade(" not in src
    assert "DROP TABLE" in src  # sqlite widen rebuild of alembic_version only
    assert "DROP TABLE yansi" not in src
    assert "ensure_alembic_version_capacity" in env_src
    assert "alembic stamp" not in env_src
    assert "run_migrations()" in env_src


def test_inspect_script_redacts_secrets_and_defaults_to_dry_run(monkeypatch, capsys, tmp_path):
    db_path = tmp_path / "capacity.db"

    class Settings:
        DATABASE_URL = f"sqlite:///{db_path.as_posix()}"
        ENV = "ci"
        EZA_ENV = "ci"

    monkeypatch.setattr("backend.config.get_settings", lambda: Settings())
    monkeypatch.setattr("backend.config.is_production_settings", lambda _settings: False)
    rc = inspect_script.main([])
    captured = capsys.readouterr().out
    assert rc == 0
    payload = json.loads(captured)
    assert payload["applyRequested"] is False
    assert payload["stampHead"] is False
    assert payload["historyRewrite"] is False
    assert payload["databaseUrlPrinted"] is False
    assert "sqlite:///" not in captured
    script_src = inspect.getsource(inspect_script)
    assert "print(settings.DATABASE_URL)" not in script_src
    assert "--force-unsafe" not in script_src


def test_env_py_does_not_log_database_url():
    env_src = (BACKEND_DIR / "migrations" / "env.py").read_text(encoding="utf-8")
    assert "print(database_url)" not in env_src
    assert "print(settings.DATABASE_URL)" not in env_src
    cap_src = inspect.getsource(capacity_mod)
    assert "DATABASE_URL" not in cap_src
    assert "postgresql://" not in cap_src


def test_changed_files_have_no_live_secrets():
    files = [
        BACKEND_DIR / "migrations" / "alembic_version_capacity.py",
        BACKEND_DIR / "migrations" / "env.py",
        BACKEND_DIR / "scripts" / "inspect_alembic_version_capacity.py",
        BACKEND_DIR / "services" / "mirror_network" / "yansi_strong_curiosity_pairwise_diagnostic.py",
    ]
    banned = (
        "sk-",
        "eyJ",
        "BEGIN RSA",
        "railway.app",
        "OPENAI_API_KEY=",
        "JWT_SECRET=",
    )
    for path in files:
        text_body = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text_body


@contextmanager
def _disposable_postgres():
    url = _pg_url()
    if not url:
        pytest.skip("EZA_MIGRATION_TEST_DATABASE_URL not set")
    maintenance = make_url(url)
    dbname = f"eza_743d_{uuid.uuid4().hex[:10]}"
    admin = create_engine(maintenance, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{dbname}"'))
    target = maintenance.set(database=dbname)
    target_url = target.render_as_string(hide_password=False)
    try:
        yield target_url
    finally:
        with admin.connect() as connection:
            connection.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ),
                {"name": dbname},
            )
            connection.execute(text(f'DROP DATABASE IF EXISTS "{dbname}"'))
        admin.dispose()


def _app_database_url(url: str) -> str:
    """Alembic env.py imports async Base; DATABASE_URL must be async-capable."""
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _run_alembic(args: list[str], database_url: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = _app_database_url(database_url)
    env["EZA_ENV"] = "ci"
    env["ENV"] = "ci"
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _redacted(blob: str) -> str:
    return inspect_script._redact(blob)


def test_postgres_varchar32_cannot_store_longest_revision():
    if not _pg_url():
        pytest.skip("EZA_MIGRATION_TEST_DATABASE_URL not set")
    with _disposable_postgres() as url:
        engine = create_engine(url)
        with engine.connect() as connection:
            connection.execute(
                text(
                    "CREATE TABLE alembic_version ("
                    "version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
                )
            )
            connection.commit()
            with pytest.raises(Exception):
                connection.execute(
                    text(
                        f"INSERT INTO alembic_version (version_num) "
                        f"VALUES ('{LONGEST_REVISION}')"
                    )
                )
            connection.rollback()
            ensure_alembic_version_capacity(connection, apply=True)
            after = inspect_alembic_version_capacity(connection)
            assert after["sufficient"] is True
            assert after["versionNumLength"] >= 128
            connection.execute(
                text(
                    f"INSERT INTO alembic_version (version_num) "
                    f"VALUES ('{LONGEST_REVISION}')"
                )
            )
            stored = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            assert stored == LONGEST_REVISION
            connection.commit()
        engine.dispose()


def test_clean_db_upgrade_head_and_phase6_from_phase42():
    if not _pg_url():
        pytest.skip("EZA_MIGRATION_TEST_DATABASE_URL not set")
    with _disposable_postgres() as url:
        failed = _run_alembic(["upgrade", "head"], url)
        combined = _redacted((failed.stdout or "") + (failed.stderr or ""))
        assert failed.returncode != 0
        assert "StringDataRightTruncation" not in combined
        assert "value too long" not in combined.lower()
        assert "production_intent_logs" in combined or "production_users" in combined

        stamped = _run_alembic(["stamp", PHASE42_REVISION], url)
        assert stamped.returncode == 0, _redacted(stamped.stderr or stamped.stdout)
        engine = create_engine(url)
        with engine.connect() as connection:
            stamped_rev = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            assert stamped_rev == PHASE42_REVISION
            assert len(stamped_rev) == 39
            assert len(stamped_rev) > ALEMBIC_DEFAULT_VERSION_NUM_LENGTH
            capacity = inspect_alembic_version_capacity(connection)
            assert capacity["sufficient"] is True
            assert capacity["versionNumLength"] >= 128
        engine.dispose()
        upgraded = _run_alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redacted(upgraded.stderr or upgraded.stdout)
        engine = create_engine(url)
        with engine.connect() as connection:
            current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            assert current == HEAD_REVISION
            assert len(current) == 25
            tables = set(sa_inspect(connection).get_table_names())
            for name in PHASE6_TABLES:
                assert name in tables
            capacity = inspect_alembic_version_capacity(connection)
            assert capacity["sufficient"] is True
        engine.dispose()
        assert "alembic stamp" not in inspect.getsource(capacity_mod).lower()
