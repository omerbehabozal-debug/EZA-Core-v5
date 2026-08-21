# -*- coding: utf-8 -*-
"""Assign public honorific (curious | bilgin) by internal user UUID.

Operator-only. No public HTTP. Does not print email, display name, or secrets.

  python -m backend.scripts.assign_public_honorific --user-id <uuid> --honorific bilgin
  python -m backend.scripts.assign_public_honorific --user-id <uuid> --honorific curious --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.production import User
from backend.services.mirror_network.public_identity import (
    PUBLIC_HONORIFIC_VALUES,
    assign_public_honorific,
    resolve_public_honorific,
)


def _database_url() -> str | None:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    return raw or None


async def _run(user_id: uuid.UUID, honorific: str, *, dry_run: bool) -> dict:
    db_url = _database_url()
    if not db_url:
        return {"ok": False, "error": "DATABASE_URL missing"}

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with Session() as session:
            user = await session.get(User, user_id)
            if user is None or not bool(getattr(user, "is_active", True)):
                return {"ok": False, "error": "user_not_found", "userId": str(user_id)}
            previous = resolve_public_honorific(user)
            if dry_run:
                return {
                    "ok": True,
                    "dryRun": True,
                    "userId": str(user_id),
                    "from": previous,
                    "to": honorific,
                }
            assigned = assign_public_honorific(user, honorific, actor="operator_cli")
            await session.commit()
            return {
                "ok": True,
                "dryRun": False,
                "userId": str(user_id),
                "from": previous,
                "to": assigned,
            }
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    parser = argparse.ArgumentParser(
        description="Assign public honorific by internal user UUID (operator-only)."
    )
    parser.add_argument("--user-id", required=True, help="production_users.id UUID")
    parser.add_argument(
        "--honorific",
        required=True,
        choices=sorted(PUBLIC_HONORIFIC_VALUES),
        help="curious or bilgin",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    try:
        user_id = uuid.UUID(str(args.user_id).strip())
    except ValueError:
        print(json.dumps({"ok": False, "error": "invalid_user_id"}))
        return 2

    report = asyncio.run(_run(user_id, args.honorific, dry_run=bool(args.dry_run)))
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
