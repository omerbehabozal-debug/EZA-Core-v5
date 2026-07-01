# EZA Observation — experience_events QA

## Feature flags (default off)

Backend (Railway / API):

```env
EXPERIENCE_EVENT_LOGGING_ENABLED=false
TRUSTED_PROXY_HEADERS_ENABLED=false
```

Frontend (Vercel):

```env
NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED=false
```

When either flag is `false`, the observation layer is fully silent:

- Frontend: no POST to `/api/eza/experience-events` (CustomEvents still fire)
- Backend: immediate `{ ok: false, reason: "disabled" }` — no body read, auth, rate limit, or DB

Enable **only on staging** after audit PASS. Set both flags together.

Do **not** set `TRUSTED_PROXY_HEADERS_ENABLED=true` until the edge proxy overwrites `X-Forwarded-For` and client IP behavior is verified in that environment.

## Purge expired rows

From `eza-v5` root:

```bash
cd eza-v5
python -m backend.scripts.purge_experience_events
```

Cron example (daily 03:15 UTC):

```cron
15 3 * * * cd /app/eza-v5 && python -m backend.scripts.purge_experience_events >> /var/log/eza-experience-purge.log 2>&1
```
