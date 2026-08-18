# -*- coding: utf-8 -*-
"""Inspect or widen alembic_version.version_num capacity.

Default is inspect/dry-run. Does not stamp head, drop tables, or print secrets.

    python -m backend.scripts.inspect_alembic_version_capacity
    python -m backend.scripts.inspect_alembic_version_capacity --apply
"""

from __future__ import annotations

import argparse
import json
import re
from typing import Any

from sqlalchemy import create_engine, inspect, text

from backend.migrations.alembic_version_capacity import (
    ALEMBIC_VERSION_TABLE,
    PHASE6_TABLES,
    ensure_alembic_version_capacity,
    inspect_alembic_version_capacity,
    revision_length_audit,
)

_SECRET_RE = re.compile(
    r"(postgresql(\+\w+)?://[^\s]+)|((password|secret|api[_-]?key|jwt)[=:][^\s]+)",
    re.IGNORECASE,
)


def _environment_label(settings: Any) -> str:
    raw = (getattr(settings, "EZA_ENV", None) or getattr(settings, "ENV", None) or "unknown")
    return str(raw).strip().lower() or "unknown"


def _redact(value: Any) -> Any:
    if isinstance(value, str):
        return _SECRET_RE.sub("[redacted]", value)
    if isinstance(value, dict):
        return {key: _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _sync_url(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return database_url


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Inspect alembic_version.version_num capacity (dry-run by default)."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Widen/create alembic_version.version_num only. Idempotent. Not a stamp.",
    )
    args = parser.parse_args(argv)

    from backend.config import get_settings, is_production_settings

    settings = get_settings()
    env_label = _environment_label(settings)
    production = is_production_settings(settings)
    audit = revision_length_audit()
    engine = create_engine(_sync_url(settings.DATABASE_URL))
    with engine.connect() as connection:
        current = inspect_alembic_version_capacity(connection)
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())
        current_revision = None
        if current["tableExists"]:
            row = connection.execute(
                text(f"SELECT version_num FROM {ALEMBIC_VERSION_TABLE}")
            ).fetchone()
            current_revision = row[0] if row else None
        report = ensure_alembic_version_capacity(connection, apply=args.apply)
        if args.apply:
            connection.commit()
        after = inspect_alembic_version_capacity(connection)

    payload = {
        "environment": env_label,
        "isProductionSettings": production,
        "productionWarning": (
            "environment=production touching=alembic_version.version_num_length_only"
            if production
            else None
        ),
        "applyRequested": bool(args.apply),
        "before": current,
        "after": after if args.apply else current,
        "action": report.get("action"),
        "applied": report.get("applied"),
        "currentRevision": current_revision,
        "revisionAudit": {
            "maxLength": audit["maxLength"],
            "longestRevision": audit["longestRevision"],
            "headRevision": audit["headRevision"],
            "headLength": audit["headLength"],
            "varchar32Insufficient": audit["varchar32Insufficient"],
        },
        "phase6TablesPresent": {
            name: name in tables for name in PHASE6_TABLES
        },
        "databaseUrlPrinted": False,
        "stampHead": False,
        "historyRewrite": False,
    }
    print(json.dumps(_redact(payload), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
