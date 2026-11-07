"""Normalize provider DATABASE_URL values for SQLAlchemy asyncio.

Railway and similar hosts often supply ``postgresql://`` or ``postgres://``.
The async engine needs ``postgresql+asyncpg://``. URLs that already name
asyncpg are left unchanged.
"""


def normalize_async_database_url(database_url: str) -> str:
    """Return a DATABASE_URL usable with ``create_async_engine``.

    Matches the production API normalization in ``dependencies``.
    """
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return database_url
