# TODO: Behavioral / Safe Mode Faz 1 — Database Migration

`behavioral_logs`, `behavioral_baselines`, and `behavioral_feedback` are defined in:

- `backend/db/behavioral_schema.sql` (reference DDL)
- `backend/models/behavioral.py` (SQLAlchemy models, registered in `init_db()`)

## Local / dev

`init_db()` runs `Base.metadata.create_all` and will create these tables on PostgreSQL when models are imported.

## Production (Railway / managed Postgres)

**Do not rely on `create_all` alone.** Add an Alembic revision:

1. `cd eza-v5/backend`
2. `alembic revision -m "add_behavioral_safe_mode_tables"`
3. Copy DDL from `backend/db/behavioral_schema.sql` into `upgrade()` / `downgrade()`
4. `alembic upgrade head` on staging, then production

## Verify after migrate

```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'behavioral_%';
```

Expected: `behavioral_logs`, `behavioral_baselines`, `behavioral_feedback`.

## Stage 2 column

If `behavioral_feedback` already exists without `event_id`, run:

```sql
ALTER TABLE behavioral_feedback ADD COLUMN IF NOT EXISTS event_id UUID;
CREATE INDEX IF NOT EXISTS idx_feedback_event ON behavioral_feedback(event_id);
```

(`init_db()` also attempts this on startup for PostgreSQL.)
