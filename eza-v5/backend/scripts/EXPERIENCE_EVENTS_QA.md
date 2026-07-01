# EZA Observation — experience_events QA

## Purge expired rows

Run manually:

```bash
cd eza-v5/backend
python -m scripts.purge_experience_events
```

Cron example (daily 03:15 UTC):

```cron
15 3 * * * cd /app/eza-v5/backend && python -m scripts.purge_experience_events >> /var/log/eza-experience-purge.log 2>&1
```

## Enable ingest (staging only)

```env
EXPERIENCE_EVENT_LOGGING_ENABLED=true
TRUSTED_PROXY_HEADERS_ENABLED=true   # only behind a trusted edge proxy
```

Do not enable in production until observation audit PASS.
