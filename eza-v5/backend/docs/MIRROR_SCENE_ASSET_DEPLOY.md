# Mirror Scene Asset Deploy Notes

Ayna Visual Identity durable scene storage requires explicit production configuration.

## Required environment variables (production)

| Variable | Example | Purpose |
|---|---|---|
| `EZA_MIRROR_SCENE_ASSET_BASE_URL` | `https://api.ezacore.ai` | Public HTTPS prefix returned to clients |
| `EZA_MIRROR_SCENE_ASSET_DIR` | `/data/mirror_scene_assets` | Writable directory for persisted PNG/JPEG/WebP files |
| `ENV` or `EZA_ENV` | `prod` | Enables startup validation |

Optional (dev/CI only):

- If `EZA_MIRROR_SCENE_ASSET_BASE_URL` is unset, backend falls back to `LOADTEST_BASE_URL` or `http://localhost:8000`.
- If `EZA_MIRROR_SCENE_ASSET_DIR` is unset, backend uses `backend/data/mirror_scene_assets` (ephemeral).

## Railway persistent volume (required)

Without a persistent volume, scene files are lost on redeploy and public URLs return 404.

1. Attach a Railway volume (e.g. mount at `/data`).
2. Set `EZA_MIRROR_SCENE_ASSET_DIR=/data/mirror_scene_assets`.
3. Set `EZA_MIRROR_SCENE_ASSET_BASE_URL=https://<your-api-host>` (must be `https://`).

## Multiple replicas

If the API runs more than one replica, all instances must share the same `EZA_MIRROR_SCENE_ASSET_DIR` via a **shared volume** (or future object storage migration). Otherwise a scene written on replica A will 404 when fetched via replica B.

## Startup validation

On production boot, the API fails fast when:

- `EZA_MIRROR_SCENE_ASSET_BASE_URL` is missing
- Base URL is not `https://`
- `EZA_MIRROR_SCENE_ASSET_DIR` is missing or equals the container-local default path

Error message is logged and the process exits before serving traffic.

## Post-deploy smoke test

After deploy or redeploy:

1. Generate a mirror scene (OpenAI provider) and confirm `sceneImageUrl` is `https://.../api/public/mirror-scene-assets/{uuid}.png`.
2. `GET` that URL directly — expect `200`, `Content-Type: image/*`, `X-Content-Type-Options: nosniff`.
3. Open the owning chat — background/sidebar thumb should load the same URL.
4. Publish mirror — public `/m/{slug}` and guest `/sohbet/session` should expose the same HTTPS scene URL.

```bash
curl -I "https://api.ezacore.ai/api/public/mirror-scene-assets/<uuid>.png"
```

Expected headers include:

- `cache-control: public, max-age=31536000, immutable`
- `x-content-type-options: nosniff`
