# Platform Bootstrap Guide

## Production

Production bootstrap requires all of:

- `ENV=production` or `EZA_ENV=production`
- `EZA_ADMIN_API_KEY` (never `dev-key`)
- A JWT with role `admin` or `org_admin`

`X-Api-Key: dev-key` is **rejected** in production.

```powershell
$body = '{"name": "EZA Core", "plan": "enterprise", "base_currency": "USD", "proxy_access": true}'
$headers = @{
  'Content-Type' = 'application/json'
  'X-Api-Key' = $env:EZA_ADMIN_API_KEY
  'Authorization' = "Bearer $($env:EZA_ADMIN_JWT)"
}
Invoke-RestMethod -Uri 'https://eza-core-v5-production.up.railway.app/api/platform/organizations' -Method POST -Headers $headers -Body $body
```

Create an organization API key the same way — production admin key + JWT, not `dev-key`:

```powershell
$orgId = '<organization-id>'
$body = '{"name": "EZA Core Proxy Key"}'
$headers = @{
  'Content-Type' = 'application/json'
  'X-Api-Key' = $env:EZA_ADMIN_API_KEY
  'Authorization' = "Bearer $($env:EZA_ADMIN_JWT)"
}
Invoke-RestMethod -Uri "https://eza-core-v5-production.up.railway.app/api/org/$orgId/api-key/create" -Method POST -Headers $headers -Body $body
```

```bash
curl -X POST "$API_BASE/api/platform/organizations" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${EZA_ADMIN_API_KEY}" \
  -H "Authorization: Bearer ${EZA_ADMIN_JWT}" \
  -d '{"name": "EZA Core", "plan": "enterprise", "base_currency": "USD", "proxy_access": true}'
```

Replace `$API_BASE` with the live API origin. Do not hard-code secrets.

## Local development only (`ENV=dev`)

`dev-key` is **LOCAL DEVELOPMENT ONLY**. Do not send it to production.

```powershell
# LOCAL DEVELOPMENT ONLY — localhost, never the production Railway URL
$body = '{"name": "EZA Core", "plan": "enterprise", "base_currency": "USD", "proxy_access": true}'
Invoke-RestMethod -Uri 'http://localhost:8000/api/platform/organizations' -Method POST -Headers @{'Content-Type'='application/json'; 'X-Api-Key'='dev-key'} -Body $body
```

## Notes

- **Local / `ENV=dev`**: `X-Api-Key: dev-key` may be used when `EZA_ADMIN_API_KEY` is unset. JWT may be skipped for bootstrap.
- **Production**: `EZA_ADMIN_API_KEY` plus admin JWT. `dev-key` is invalid.
- **Path parameter**: `/api/org/{org_id}/...` extracts `org_id` from the path (no `x-org-id` header).
- **Organization guard**: middleware validates organization existence and user membership.
