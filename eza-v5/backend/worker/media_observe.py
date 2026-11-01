"""Observation worker. It describes stored images and original videos.

Run from the eza-v5 tree:

    python -m backend.worker.media_observe

The process claims nothing unless the feature flag and a vision model are set.
It does not call main() from tests.
"""
import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

POLL_SECONDS = 1.0


async def _finish(session_factory, held, completer, reader, materialize, extract):
    from backend.services.business_yansi.video_observe import analyze_media_claim

    async with session_factory() as db:
        await analyze_media_claim(
            db, held, completer=completer, reader=reader, materialize=materialize, extract=extract,
        )
        await db.commit()


async def serve(
    session_factory,
    *,
    stop: asyncio.Event | None = None,
    completer=None,
    reader=None,
    materialize=None,
    extract=None,
) -> None:
    """Recover stale claims, then describe up to the concurrency limit."""
    from backend.services.business_yansi.image_observe import credentials_ready
    from backend.services.business_yansi.media_observations import (
        analyzer_ready,
        claim_next_visual,
        concurrency,
        enabled,
        recover_stale,
    )

    while stop is None or not stop.is_set():
        held = []
        async with session_factory() as db:
            await recover_stale(db)
            if enabled() and (completer is not None or (analyzer_ready() and credentials_ready())):
                for _slot in range(concurrency()):
                    job = await claim_next_visual(db)
                    if job is None:
                        break
                    held.append((job.id, job.claim_token, job.business_id))
            await db.commit()
        if held:
            await asyncio.gather(*[
                _finish(session_factory, item, completer, reader, materialize, extract) for item in held
            ])
            continue
        if stop is not None and stop.is_set():
            return
        await asyncio.sleep(POLL_SECONDS)


def main() -> None:
    from backend.config import settings

    engine = create_async_engine(settings.DATABASE_URL)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def close() -> None:
        await engine.dispose()

    try:
        asyncio.run(serve(factory))
    finally:
        asyncio.run(close())


if __name__ == "__main__":
    main()
