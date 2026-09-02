# -*- coding: utf-8 -*-
"""
Phase 7.4.3d — alembic_version.version_num capacity.

Alembic 1.12.1 creates alembic_version.version_num as VARCHAR(32) by default.
This repository has revision identifiers longer than 32 characters, so the
version table must be VARCHAR(128) *before* a long revision is persisted.

This helper only inspects/creates/widens alembic_version.version_num.
It does not stamp revisions, rewrite history, or touch application tables.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection

ALEMBIC_VERSION_TABLE = "alembic_version"
ALEMBIC_VERSION_COLUMN = "version_num"
ALEMBIC_VERSION_NUM_LENGTH = 128
ALEMBIC_DEFAULT_VERSION_NUM_LENGTH = 32
HEAD_REVISION = "add_standalone_conversations_g8811_v1"
PHASE6_TABLES = (
    "yansi_experience_events",
    "yansi_exposure_events",
    "yansi_own_continuation_events",
)

_REVISION_RE = re.compile(r"^revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]", re.MULTILINE)

VERSIONS_DIR = Path(__file__).resolve().parent / "versions"


def load_revision_identifiers(versions_dir: Path | None = None) -> list[str]:
    root = versions_dir or VERSIONS_DIR
    found: list[str] = []
    for path in sorted(root.glob("*.py")):
        if path.name.startswith("__"):
            continue
        text_body = path.read_text(encoding="utf-8")
        match = _REVISION_RE.search(text_body)
        if match:
            found.append(match.group(1))
    return found


def revision_length_audit(versions_dir: Path | None = None) -> dict[str, Any]:
    ids = load_revision_identifiers(versions_dir)
    lengths = {rev: len(rev) for rev in ids}
    longest = max(ids, key=len) if ids else ""
    return {
        "count": len(ids),
        "identifiers": ids,
        "lengths": lengths,
        "maxLength": lengths.get(longest, 0),
        "longestRevision": longest,
        "headRevision": HEAD_REVISION,
        "headLength": len(HEAD_REVISION),
        "varchar32Insufficient": any(length > ALEMBIC_DEFAULT_VERSION_NUM_LENGTH for length in lengths.values()),
        "requiredLength": ALEMBIC_VERSION_NUM_LENGTH,
    }


def _column_length(connection: Connection) -> int | None:
    inspector = inspect(connection)
    if ALEMBIC_VERSION_TABLE not in inspector.get_table_names():
        return None
    for column in inspector.get_columns(ALEMBIC_VERSION_TABLE):
        if column.get("name") == ALEMBIC_VERSION_COLUMN:
            col_type = column.get("type")
            return getattr(col_type, "length", None)
    return None


def inspect_alembic_version_capacity(connection: Connection) -> dict[str, Any]:
    dialect = connection.dialect.name
    inspector = inspect(connection)
    exists = ALEMBIC_VERSION_TABLE in inspector.get_table_names()
    current_length = _column_length(connection) if exists else None
    sufficient = bool(
        exists
        and (
            current_length is None
            or int(current_length) >= ALEMBIC_VERSION_NUM_LENGTH
        )
    )
    if not exists:
        status = "MISSING"
        guidance = (
            "alembic_version is missing. Create it with VARCHAR(128) before "
            "persisting any revision identifier, or run alembic upgrade with "
            "the env.py capacity hook."
        )
    elif current_length is not None and int(current_length) < ALEMBIC_VERSION_NUM_LENGTH:
        status = "INSUFFICIENT"
        guidance = (
            "alembic_version.version_num is shorter than 128. Widen only that "
            "column (idempotent). Do not stamp head, drop tables, or rewrite "
            "revision identifiers."
        )
    else:
        status = "OK"
        guidance = "alembic_version.version_num capacity is sufficient."
    return {
        "tableExists": exists,
        "dialect": dialect,
        "versionNumLength": current_length,
        "requiredLength": ALEMBIC_VERSION_NUM_LENGTH,
        "alembicDefaultLength": ALEMBIC_DEFAULT_VERSION_NUM_LENGTH,
        "sufficient": sufficient,
        "status": status,
        "guidance": guidance,
        "touchedTables": [ALEMBIC_VERSION_TABLE] if exists else [],
    }


def _create_version_table(connection: Connection) -> None:
    length = int(ALEMBIC_VERSION_NUM_LENGTH)
    connection.execute(
        text(
            f"CREATE TABLE {ALEMBIC_VERSION_TABLE} ("
            f"{ALEMBIC_VERSION_COLUMN} VARCHAR({length}) NOT NULL PRIMARY KEY"
            f")"
        )
    )


def _widen_postgres(connection: Connection) -> None:
    length = int(ALEMBIC_VERSION_NUM_LENGTH)
    connection.execute(
        text(
            f"ALTER TABLE {ALEMBIC_VERSION_TABLE} "
            f"ALTER COLUMN {ALEMBIC_VERSION_COLUMN} TYPE VARCHAR({length})"
        )
    )


def _widen_sqlite(connection: Connection) -> None:
    length = int(ALEMBIC_VERSION_NUM_LENGTH)
    old = f"{ALEMBIC_VERSION_TABLE}__old_capacity"
    connection.execute(text(f"ALTER TABLE {ALEMBIC_VERSION_TABLE} RENAME TO {old}"))
    _create_version_table(connection)
    connection.execute(
        text(
            f"INSERT INTO {ALEMBIC_VERSION_TABLE} ({ALEMBIC_VERSION_COLUMN}) "
            f"SELECT {ALEMBIC_VERSION_COLUMN} FROM {old}"
        )
    )
    connection.execute(text(f"DROP TABLE {old}"))


def ensure_alembic_version_capacity(
    connection: Connection,
    *,
    apply: bool,
) -> dict[str, Any]:
    """
    Create or widen alembic_version.version_num only.

    apply=False is inspect/dry-run. apply=True is idempotent and non-destructive.
    """
    before = inspect_alembic_version_capacity(connection)
    report = {
        **before,
        "applyRequested": bool(apply),
        "action": "none",
        "applied": False,
    }
    if before["sufficient"]:
        report["action"] = "already_sufficient"
        return report
    if not apply:
        report["action"] = "dry_run"
        return report
    if not before["tableExists"]:
        _create_version_table(connection)
        report["action"] = "created_varchar_128"
    else:
        dialect = before["dialect"]
        if dialect == "postgresql":
            _widen_postgres(connection)
        elif dialect == "sqlite":
            _widen_sqlite(connection)
        else:
            raise RuntimeError(
                f"alembic_version_capacity_unsupported_dialect:{dialect}"
            )
        report["action"] = "widened_to_varchar_128"
    after = inspect_alembic_version_capacity(connection)
    report.update(
        {
            "tableExists": after["tableExists"],
            "versionNumLength": after["versionNumLength"],
            "sufficient": after["sufficient"],
            "status": after["status"],
            "guidance": after["guidance"],
            "applied": True,
            "touchedTables": [ALEMBIC_VERSION_TABLE],
        }
    )
    if not after["sufficient"]:
        raise RuntimeError("alembic_version_capacity_ensure_failed")
    return report
