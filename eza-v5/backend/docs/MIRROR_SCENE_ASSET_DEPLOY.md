# Mirror Scene Asset & Production Deploy Guide

Ayna Visual Identity and Mirror Network production deploy checklist.

## 1. Database migration (before or with backend deploy)

Run from `eza-v5/backend`:

```bash
alembic current
alembic upgrade head
```

Expected HEAD revision: `add_mirror_continuation_proofs`

### Migration chain

```text
4c2bee92df6f
→ add_deleted_by_user
→ 20260516_governance
→ add_user_mirror_plan
→ add_mirror_network_nodes
→ add_conversation_groups
→ add_experience_events
→ add_mirror_network_publish_unique   ← duplicate preflight required
→ add_mirror_continuation_proofs      ← HEAD
```

### Duplicate preflight (required before `add_mirror_network_publish_unique`)

If this revision is not yet applied, run on production Postgres:

```sql
SELECT user_id, conversation_id, COUNT(*) AS row_count
FROM mirror_network_nodes
WHERE conversation_id IS NOT NULL
GROUP BY user_id, conversation_id
HAVING COUNT(*) > 1;
```

Must return **0 rows**. Resolve duplicates manually before migration.

### Post-migration verification

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'mirror_continuation_proofs'
);
```

## 2. Railway persistent volume (required)

Without a persistent volume, scene files are lost on redeploy and public URLs return 404.

1. Attach a Railway volume mounted at `/data`.
2. Set `EZA_MIRROR_SCENE_ASSET_DIR=/data/mirror_scene_assets`.
3. Ensure the directory is writable by the API process.

### Multiple replicas

All API replicas must share the same `EZA_MIRROR_SCENE_ASSET_DIR` via a **shared volume**. Otherwise a scene written on replica A returns 404 from replica B.

## 3. Backend environment variables (production)

| Variable | Example | Required |
|---|---|---|
| `ENV` or `EZA_ENV` | `prod` | Yes — enables startup validation |
| `EZA_MIRROR_IMAGE_PROVIDER` | `openai` | Yes |
| `OPENAI_API_KEY` | `sk-...` | Yes |
| `EZA_MIRROR_SCENE_ASSET_BASE_URL` | `https://api.ezacore.ai` | Yes — must be `https://` |
| `EZA_MIRROR_SCENE_ASSET_DIR` | `/data/mirror_scene_assets` | Yes — not the container default |
| `DATABASE_URL` | Postgres connection string | Yes |

Startup **fails fast** (process exits) when production config is invalid.

Bypass guard: if `OPENAI_API_KEY` + `EZA_MIRROR_IMAGE_PROVIDER=openai` or `EZA_MIRROR_SCENE_ASSET_BASE_URL` is set without `ENV/EZA_ENV=prod`, startup also fails.

## 4. Frontend environment variables (production)

| Variable | Example | Purpose |
|---|---|---|
| `NEXT_PUBLIC_EZA_API_URL` | `https://api.ezacore.ai` | Must match asset base host |

Optional:

| Variable | Recommended launch value |
|---|---|
| `NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED` | unset or `false` |

## 5. Startup validation summary

On production boot, the API fails when:

- `ENV` or `EZA_ENV` is not `prod` / `production` (including prod-intent bypass)
- `EZA_MIRROR_IMAGE_PROVIDER` is not `openai`
- `OPENAI_API_KEY` is missing
- `EZA_MIRROR_SCENE_ASSET_BASE_URL` is missing or not `https://`
- `EZA_MIRROR_SCENE_ASSET_DIR` is missing or equals the ephemeral default path

## 6. Post-deploy smoke test

1. **Generate mirror scene** — `POST /api/standalone/mirror/generate-scene` returns `sceneImageUrl` like `https://.../api/public/mirror-scene-assets/{uuid}.png` (no `data:` / `blob:`).
2. **Asset fetch** — `curl -I <sceneImageUrl>` → `200`, `x-content-type-options: nosniff`, `cache-control: public, max-age=31536000, immutable`.
3. **Archive / Visual Identity** — owning chat background crossfade + sidebar thumb use the same URL.
4. **Publish** — `POST /api/mirror-network/publish` succeeds; archive `conversationSceneSource` becomes `mirror_network`.
5. **Public mirror** — `/m/{slug}` shows the same scene image.
6. **Guest session** — `/sohbet/session` response includes the same `sceneImageUrl`.
7. **Redeploy persistence** — repeat `curl -I` on the same asset URL after redeploy → still `200`.

```bash
curl -I "https://api.ezacore.ai/api/public/mirror-scene-assets/<uuid>.png"
```

## 7. Manual steps not automated in repo

- Railway volume attach + mount path
- Setting platform env vars (no `railway.toml` in repo)
- `alembic upgrade head` on production (not in Dockerfile `CMD`)
- Duplicate preflight SQL before first publish_unique migration
- Production smoke test execution
