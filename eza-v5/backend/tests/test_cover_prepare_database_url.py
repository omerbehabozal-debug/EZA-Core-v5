"""Cover worker DATABASE_URL normalization without API JWT settings."""
import pytest
from sqlalchemy.engine.url import make_url

from backend.core.utils.database_url import normalize_async_database_url
from backend.worker.cover_prepare import resolve_database_url


def test_normalize_postgresql_to_asyncpg():
    url = normalize_async_database_url(
        "postgresql://user:pass@postgres.railway.internal:5432/railway"
    )
    assert make_url(url).drivername == "postgresql+asyncpg"
    assert url.startswith("postgresql+asyncpg://")


def test_normalize_postgres_scheme_to_asyncpg():
    url = normalize_async_database_url("postgres://user:pass@db.example:5432/app")
    assert make_url(url).drivername == "postgresql+asyncpg"


def test_normalize_preserves_asyncpg_url():
    raw = "postgresql+asyncpg://user:pass@db.example:5432/app"
    assert normalize_async_database_url(raw) == raw


def test_normalize_matches_api_dependencies_rules():
    """Same replacements the production API historically applied inline."""
    assert (
        normalize_async_database_url("postgresql://a:b@h/db")
        == "postgresql+asyncpg://a:b@h/db"
    )
    assert (
        normalize_async_database_url("postgres://a:b@h/db")
        == "postgresql+asyncpg://a:b@h/db"
    )
    assert (
        normalize_async_database_url("postgresql+asyncpg://a:b@h/db")
        == "postgresql+asyncpg://a:b@h/db"
    )


def test_resolve_database_url_normalizes_railway_postgresql(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://worker:secret@postgres.railway.internal:5432/railway",
    )
    url = resolve_database_url()
    assert make_url(url).drivername == "postgresql+asyncpg"


def test_resolve_database_url_preserves_asyncpg(monkeypatch):
    raw = "postgresql+asyncpg://worker:secret@postgres.railway.internal:5432/railway"
    monkeypatch.setenv("DATABASE_URL", raw)
    assert resolve_database_url() == raw


def test_resolve_database_url_requires_nonempty(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL is required") as raised:
        resolve_database_url()
    assert "postgresql" not in str(raised.value).lower()
    assert "secret" not in str(raised.value).lower()
    assert "@" not in str(raised.value)


def test_resolve_database_url_rejects_blank(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "   ")
    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        resolve_database_url()


def _run_main_capturing_engine_url(monkeypatch, database_url: str) -> str:
    from backend.worker import cover_prepare

    captured = {}

    class _Store:
        async def aclose(self):
            return None

    class _Engine:
        async def dispose(self):
            return None

    def fake_create_async_engine(url, **kwargs):
        captured["url"] = url
        return _Engine()

    monkeypatch.setattr(cover_prepare, "create_async_engine", fake_create_async_engine)
    monkeypatch.setattr(cover_prepare, "async_sessionmaker", lambda *a, **k: (lambda: None))
    monkeypatch.setattr(
        "backend.services.business_yansi.video_storage.video_store_from_env",
        lambda: _Store(),
    )
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.delenv("EZA_JWT_SECRET", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")

    def boom():
        raise AssertionError("get_settings must not run in cover_prepare.main")

    monkeypatch.setattr("backend.config.get_settings", boom)

    def fake_run(coro):
        if hasattr(coro, "close"):
            coro.close()
        return None

    monkeypatch.setattr(cover_prepare.asyncio, "run", fake_run)
    cover_prepare.main()
    return captured["url"]


def test_cover_prepare_main_builds_engine_with_normalized_url(monkeypatch):
    url = _run_main_capturing_engine_url(
        monkeypatch,
        "postgresql://worker:secret@postgres.railway.internal:5432/railway",
    )
    assert make_url(url).drivername == "postgresql+asyncpg"
    assert url.startswith("postgresql+asyncpg://")


def test_cover_prepare_main_preserves_asyncpg_configuration(monkeypatch):
    raw = "postgresql+asyncpg://worker:secret@postgres.railway.internal:5432/railway"
    assert _run_main_capturing_engine_url(monkeypatch, raw) == raw


def test_cover_prepare_main_starts_without_jwt_secrets(monkeypatch):
    url = _run_main_capturing_engine_url(
        monkeypatch,
        "postgresql://worker:secret@postgres.railway.internal:5432/railway",
    )
    assert make_url(url).drivername == "postgresql+asyncpg"


def test_cover_prepare_main_fails_when_database_url_missing(monkeypatch):
    from backend.worker import cover_prepare

    class _Store:
        async def aclose(self):
            return None

    monkeypatch.setattr(
        "backend.services.business_yansi.video_storage.video_store_from_env",
        lambda: _Store(),
    )
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("EZA_JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL is required") as raised:
        cover_prepare.main()
    assert "://" not in str(raised.value)
