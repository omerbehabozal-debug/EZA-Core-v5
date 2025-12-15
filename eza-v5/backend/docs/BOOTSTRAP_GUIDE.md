# Platform Bootstrap Guide

## Creating Your First Organization

### Step 1: Create Organization (Bootstrap)

**Development Mode** (ENV=dev):
```powershell
$body = '{"name": "EZA Core", "plan": "enterprise", "base_currency": "USD", "proxy_access": true}'
Invoke-RestMethod -Uri 'https://eza-core-v5-production.up.railway.app/api/platform/organizations' -Method POST -Headers @{'Content-Type'='application/json'; 'X-Api-Key'='dev-key'} -Body $body
```

**Response**:
```json
{
  "ok": true,
  "organization": {
    "id": "e9a68fc9-d3bb-436d-b952-120eca6d90df",
    "name": "EZA Core",
    "plan": "enterprise",
    "status": "active",
    ...
  }
}
```

### Step 2: Create API Key for Organization

Use the `org_id` from Step 1:

```powershell
$orgId = "e9a68fc9-d3bb-436d-b952-120eca6d90df"
$body = '{"name": "EZA Core Proxy Key"}'
Invoke-RestMethod -Uri "https://eza-core-v5-production.up.railway.app/api/org/$orgId/api-key/create" -Method POST -Headers @{'Content-Type'='application/json'; 'X-Api-Key'='dev-key'} -Body $body
```

**Response**:
```json
{
  "ok": true,
  "api_key": "ezak_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6",
  "key_id": "abc123def456",
  "name": "EZA Core Proxy Key",
  "message": "API key created. Save it securely - it won't be shown again."
}
```

## Notes

- **Development Mode**: Only requires `X-Api-Key: dev-key` (no JWT needed)
- **Production Mode**: Requires both `X-Api-Key` (EZA_ADMIN_API_KEY) and JWT token with admin role
- **Path Parameter**: `/api/org/{org_id}/...` endpoints automatically extract `org_id` from path (no `x-org-id` header needed)
- **Organization Guard**: Middleware validates organization existence and user membership

