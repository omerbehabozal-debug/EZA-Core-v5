# EZA Platform API Keys Documentation

## API Key Types

### 1. Admin API Key (Platform Admin)

**Location**: Environment variable `EZA_ADMIN_API_KEY`

**Usage**: 
- Set in `.env` file or environment variables
- Used for admin-only internal endpoints
- Format: Any string value

**Example**:
```bash
EZA_ADMIN_API_KEY=your-secret-admin-key-here
```

**Swagger/API Testing**:
- Header: `X-Api-Key: your-secret-admin-key-here`
- Development mode: If not set, uses `"dev-key"` automatically

### 2. Organization API Key (ezak_ prefix)

**Location**: Created via API endpoint `/api/org/{org_id}/api-key/create`

**Format**: `ezak_<random-token>`

**Example**: `ezak_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6`

**Creation**:
```bash
POST /api/org/{org_id}/api-key/create
Headers:
  Authorization: Bearer <JWT_TOKEN>
  X-Api-Key: <admin_or_org_api_key>
Body:
  {
    "name": "My API Key"
  }
```

**Response**:
```json
{
  "ok": true,
  "api_key": "ezak_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6",
  "key_id": "abc123def456",
  "name": "My API Key",
  "message": "API key created. Save it securely - it won't be shown again."
}
```

## Swagger Usage

### For Admin Endpoints:
1. Click "Authorize" button in Swagger UI
2. Enter your `EZA_ADMIN_API_KEY` value in the `X-Api-Key` field
3. Or set it in the header manually: `X-Api-Key: your-admin-key`

### For Organization Endpoints:
1. Use organization API key: `X-Api-Key: ezak_<your-org-key>`
2. Also requires JWT token: `Authorization: Bearer <jwt-token>`

## Development Mode

In development mode (`ENV=dev`):
- Admin API key is **optional** (uses `"dev-key"` if not set)
- Organization API keys still work normally
- JWT token is still required for most endpoints

## Production Mode

In production mode:
- `EZA_ADMIN_API_KEY` **must** be set
- All API key validations are enforced
- Invalid keys return `401 Unauthorized`

## Getting Your API Key

### Admin API Key:
1. Set `EZA_ADMIN_API_KEY` in your `.env` file
2. Or set it as environment variable before starting backend

### Organization API Key:
1. Login with admin/org_admin role
2. Create or select an organization
3. Call `POST /api/org/{org_id}/api-key/create`
4. Save the returned `api_key` value (shown only once!)

## Security Notes

- **Never commit API keys to version control**
- **Organization API keys are shown only once** - save them immediately
- **Rotate keys regularly** in production
- **Use different keys for different environments** (dev/staging/prod)

