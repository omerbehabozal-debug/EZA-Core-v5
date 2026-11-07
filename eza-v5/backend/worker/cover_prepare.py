"""Separate cover worker. It claims Postgres rows, then encodes outside that claim.

Run from the eza-v5 tree:

    python -m backend.worker.cover_prepare
"""
import asyncio
import os

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

POLL_SECONDS = 1.0


def resolve_database_url() -> str:
    """Read DATABASE_URL without loading API settings (no JWT enforcement)."""
    from backend.core.utils.database_url import normalize_async_database_url

    raw = (os.environ.get("DATABASE_URL") or "").strip()
    if not raw:
        raise RuntimeError("DATABASE_URL is required")
    return normalize_async_database_url(raw)


class _HeldClaim:
    """The claim token copied out of the session that committed it."""

    def __init__(self, job_id, claim_token):
        self.id = job_id
        self.claim_token = claim_token
        self.status = "running"


async def serve(session_factory, *, store=None, stop: asyncio.Event | None = None) -> None:
    """Claim in one transaction, then classify or encode in another.

    A crash after the claim leaves a running row. Recovery sends a
    classification claim back to queued and an encode claim back to
    awaiting_encode. Final objects are not deleted.
    """
    from backend.services.business_yansi.cover_jobs import claim_encode, claim_next, encode_claimed, recover_stale, settle

    while stop is None or not stop.is_set():
        async with session_factory() as db:
            await recover_stale(db)
            claimed = await claim_next(db)
            mode = "classify"
            if claimed is None:
                claimed = await claim_encode(db)
                mode = "encode"
            held = None if claimed is None else (claimed.id, claimed.claim_token, mode)
            await db.commit()
        if held is None:
            await asyncio.sleep(POLL_SECONDS)
            continue
        async with session_factory() as db:
            claim = _HeldClaim(held[0], held[1])
            if held[2] == "encode":
                await encode_claimed(db, claim, store)
            else:
                await settle(db, claim)
            await db.commit()


def main() -> None:
    from backend.services.business_yansi.video_storage import video_store_from_env

    database_url = resolve_database_url()
    store = video_store_from_env()
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def close() -> None:
        await store.aclose()
        await engine.dispose()

    try:
        asyncio.run(serve(factory, store=store))
    finally:
        asyncio.run(close())


if __name__ == "__main__":
    main()
