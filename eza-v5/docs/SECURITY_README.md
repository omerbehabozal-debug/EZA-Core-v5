# EZA-Core Security Documentation

## Overview

EZA-Core implements a comprehensive security layer for production deployment, including JWT authentication, role-based access control, rate limiting, API key enforcement, CORS protection, and sensitive data filtering.

---

## 1. JWT Authentication (Role-Based)

### Configuration

**Environment Variables:**
```bash
EZA_JWT_SECRET=your-secret-key-here  # Production JWT secret
```

**Default:** Falls back to `JWT_SECRET` from config if `EZA_JWT_SECRET` is not set.

### Token Creation

```python
from backend.auth.jwt import create_jwt

# Create JWT token
token = create_jwt(
    user_id=123,
    role="admin",  # or "corporate", "regulator"
    expires_in_hours=8  # Default: 8 hours
)
```

### Token Validation

```python
from backend.auth.jwt import decode_jwt, get_user_from_token

# Decode token
payload = decode_jwt(token)
# Returns: {"sub": "123", "role": "admin", "exp": ..., "iat": ...}

# Get user info
user_info = get_user_from_token(token)
# Returns: {"user_id": 123, "role": "admin"}
```

### Using in Endpoints

```python
from backend.auth.deps import require_admin, require_corporate_or_admin

@app.post("/api/proxy")
async def proxy_endpoint(
    request: ProxyRequest,
    _: dict = Depends(require_admin())  # Admin only
):
    ...
```

### Role-Based Permissions

| Endpoint | Required Role | Notes |
|----------|--------------|-------|
| `/api/standalone` | **None** (Public) | No authentication required |
| `/api/proxy` | `admin` | Admin only |
| `/api/proxy-lite` | `corporate` OR `admin` | Corporate or admin |
| `/api/monitor/live-feed` | `admin` | Admin only |
| `/api/monitor/corporate-feed` | `corporate` OR `admin` | Corporate or admin |
| `/api/monitor/regulator-feed` | `regulator` OR `admin` | Regulator or admin |

### JWT Flow

1. **Login** → User authenticates via `/api/auth/login`
2. **Token Issuance** → Server creates JWT with user_id and role
3. **Token Usage** → Client sends token in `Authorization: Bearer <token>` header
4. **Validation** → Server validates token and extracts role
5. **Authorization** → Server checks role against endpoint requirements

---

## 2. API Key Enforcement

### Configuration

**Environment Variables:**
```bash
EZA_ADMIN_API_KEY=your-admin-api-key-here
```

### Protected Endpoints

- `/api/test-results/latest` → Requires `X-Api-Key` header
- `/api/internal/*` → All internal endpoints require API key

### Usage

```python
from backend.auth.api_key import require_api_key

@router.get("/latest")
async def get_latest(
    _: str = require_api_key()  # API key required
):
    ...
```

### Client Request

```bash
curl -H "X-Api-Key: your-admin-api-key" \
     http://localhost:8000/api/test-results/latest
```

---

## 3. Rate Limiting (Redis)

### Configuration

**Environment Variables:**
```bash
EZA_REDIS_URL=redis://localhost:6379  # Optional, falls back to REDIS_URL
```

**Fallback:** If Redis is unavailable, in-memory rate limiting is used (not persistent across restarts).

### Rate Limits

| Endpoint | Limit | Window | Key Prefix |
|----------|-------|--------|------------|
| `/api/standalone` | 40 requests | 60 seconds | `standalone` |
| `/api/proxy` | 15 requests | 60 seconds | `proxy` |
| `/api/monitor/regulator-feed` | 10 requests | 60 seconds | `regulator_feed` |
| WebSocket handshake | 20 requests | 120 seconds | `ws_handshake` |

### Rate Limit Response

When limit is exceeded:
```json
{
  "ok": false,
  "error": "rate_limit",
  "message": "Rate limit exceeded: 40 requests per 60 seconds"
}
```

**HTTP Status:** `429 Too Many Requests`

### Implementation

```python
from backend.security.rate_limit import rate_limit_standalone

@app.post("/api/standalone")
async def standalone_endpoint(
    request: StandaloneRequest,
    _: None = Depends(rate_limit_standalone)  # Rate limiting
):
    ...
```

### IP Detection

Rate limiting uses client IP from:
1. `X-Forwarded-For` header (if behind proxy)
2. `X-Real-IP` header
3. Direct client IP

---

## 4. Sensitive Logger Filter

### Protected Fields

The following fields are automatically masked in logs (production mode):

- `user_input`
- `raw_output`
- `safe_answer`
- `password`
- `api_key`
- `token`
- `secret`

### Configuration

**Environment Variables:**
```bash
EZA_ENV=prod  # Production mode enables sensitive data filtering
```

### Log Levels

- **Production (`EZA_ENV=prod`)**: `INFO` and `ERROR` only (debug disabled)
- **Development (`EZA_ENV=dev`)**: `DEBUG`, `INFO`, `ERROR` (all levels)

### Example

**Before filtering:**
```json
{
  "user_input": "How to hack a system?",
  "safe_answer": "I cannot help with that."
}
```

**After filtering (production):**
```json
{
  "user_input": "[REDACTED]",
  "safe_answer": "[REDACTED]"
}
```

---

## 5. CORS Domain Whitelist

### Allowed Origins

```python
allowed_origins = [
    "https://standalone.ezacore.ai",
    "https://proxy.ezacore.ai",
    "https://corporate.ezacore.ai",
    "https://regulator.ezacore.ai",
    "https://platform.ezacore.ai",
    "https://admin.ezacore.ai",
    "http://localhost:3000",
    "http://localhost:3001",
]
```

### Configuration

- **Credentials:** `allow_credentials = True`
- **Methods:** All methods allowed (`*`)
- **Headers:** All headers allowed (`*`)

### Behavior

- **Whitelisted origins:** CORS headers include origin, credentials allowed
- **Non-whitelisted origins:** CORS headers do not include origin (blocked)

---

## 6. Endpoint Permission System

### Permission Matrix

| Endpoint | Auth Required | Role Required | Rate Limit |
|----------|---------------|---------------|------------|
| `/api/standalone` | ❌ No | - | ✅ 40/60s |
| `/api/proxy` | ✅ Yes | `admin` | ✅ 15/60s |
| `/api/proxy-lite` | ✅ Yes | `corporate` OR `admin` | - |
| `/api/monitor/live-feed` | ✅ Yes | `admin` | - |
| `/api/monitor/corporate-feed` | ✅ Yes | `corporate` OR `admin` | - |
| `/api/monitor/regulator-feed` | ✅ Yes | `regulator` OR `admin` | ✅ 10/60s |
| `/api/test-results/latest` | ✅ API Key | - | - |
| `/api/internal/*` | ✅ API Key | - | - |

### Implementation Example

```python
from backend.auth.deps import require_admin, require_corporate_or_admin
from backend.security.rate_limit import rate_limit_proxy

@app.post("/api/proxy")
async def proxy_endpoint(
    request: ProxyRequest,
    db=Depends(get_db),
    _: dict = Depends(require_admin()),  # Admin only
    __: None = Depends(rate_limit_proxy)  # Rate limiting
):
    ...
```

---

## 7. WebSocket Authentication

### Authentication Method

WebSocket authentication uses JWT token in query parameter:

```
ws://localhost:8000/ws/corporate?token=<jwt_token>
```

### Channel Permissions

| WebSocket Endpoint | Required Role |
|-------------------|---------------|
| `/ws/live` | `admin` |
| `/ws/corporate` | `corporate` OR `admin` |
| `/ws/regulator` | `regulator` OR `admin` |

### Authentication Flow

1. **Client connects** → `ws://.../ws/corporate?token=xxx`
2. **Server validates token** → Extracts role from JWT
3. **Server checks role** → Verifies role matches channel requirements
4. **Connection accepted/rejected**:
   - ✅ Valid role → Connection accepted
   - ❌ Invalid/missing token → `websocket.close(code=4401, reason="unauthorized")`
   - ❌ Wrong role → `websocket.close(code=4401, reason="unauthorized: role X not allowed")`

### Rate Limiting

WebSocket handshakes are rate limited:
- **Limit:** 20 handshakes per 2 minutes per IP
- **Enforcement:** Before authentication (prevents brute force)

### Example (JavaScript)

```javascript
const token = "your-jwt-token";
const ws = new WebSocket(`ws://localhost:8000/ws/corporate?token=${token}`);

ws.onopen = () => {
  console.log('Connected!');
};

ws.onerror = (error) => {
  console.error('Connection error:', error);
  // Check for 4401 (unauthorized) or rate limit errors
};

ws.onclose = (event) => {
  if (event.code === 4401) {
    console.error('Unauthorized:', event.reason);
  }
};
```

---

## 8. Environment Variables Summary

### Required for Production

```bash
# JWT
EZA_JWT_SECRET=your-secret-key-here

# API Keys
EZA_ADMIN_API_KEY=your-admin-api-key

# Redis (for rate limiting)
EZA_REDIS_URL=redis://localhost:6379

# Environment
EZA_ENV=prod  # Enables production security features
```

### Optional (with defaults)

```bash
# Falls back to JWT_SECRET if not set
EZA_JWT_SECRET=...

# Falls back to REDIS_URL if not set
EZA_REDIS_URL=...
```

---

## 9. Testing

### Run Security Tests

```bash
# All security tests
pytest backend/tests_security/ -v

# JWT authentication tests
pytest backend/tests_security/test_jwt_auth.py -v

# Rate limiting tests
pytest backend/tests_security/test_rate_limit.py -v

# WebSocket authentication tests
pytest backend/tests_security/test_ws_auth.py -v

# CORS tests
pytest backend/tests_security/test_cors.py -v

# API key tests
pytest backend/tests_security/test_api_key.py -v
```

### Test Coverage

- ✅ JWT token creation and validation
- ✅ Role-based access control
- ✅ Rate limiting (Redis and in-memory fallback)
- ✅ WebSocket authentication
- ✅ CORS whitelist enforcement
- ✅ API key validation

---

## 10. Security Best Practices

### Production Checklist

- [ ] Set `EZA_JWT_SECRET` to a strong, random secret
- [ ] Set `EZA_ADMIN_API_KEY` to a secure API key
- [ ] Configure `EZA_REDIS_URL` for persistent rate limiting
- [ ] Set `EZA_ENV=prod` to enable all security features
- [ ] Review CORS whitelist and remove localhost origins if needed
- [ ] Monitor rate limit violations in logs
- [ ] Rotate JWT secrets periodically
- [ ] Use HTTPS in production (WebSocket: `wss://`)

### Development

- In dev mode, some security features are relaxed:
  - API key validation may allow requests if key is not configured
  - Debug logging is enabled
  - CORS allows localhost origins

---

## 11. Troubleshooting

### Common Issues

**1. "Invalid or expired token"**
- Check JWT secret matches between services
- Verify token hasn't expired (8 hours default)
- Ensure token is sent in `Authorization: Bearer <token>` header

**2. "Rate limit exceeded"**
- Wait for rate limit window to reset
- Check Redis connection if using Redis rate limiting
- Verify IP detection is working correctly

**3. "CORS error"**
- Verify origin is in whitelist
- Check `allow_credentials` is set correctly
- Ensure preflight OPTIONS request succeeds

**4. "WebSocket connection failed (4401)"**
- Verify JWT token is valid and not expired
- Check role matches channel requirements
- Ensure token is passed in query parameter: `?token=xxx`

---

## 12. Architecture Diagram

```
Client Request
    ↓
[CORS Check] → Whitelist validation
    ↓
[Rate Limit] → Redis/In-memory check
    ↓
[Authentication] → JWT or API Key
    ↓
[Authorization] → Role-based check
    ↓
[Logger Filter] → Mask sensitive data (prod)
    ↓
Endpoint Handler
```

---

## 13. Support

For security issues or questions:
- Review test files in `backend/tests_security/`
- Check logs for authentication/authorization failures
- Verify environment variables are set correctly
- Test with curl/Postman before frontend integration

---

**Last Updated:** 2025-01-15  
**Version:** 6.0.0  
**Status:** Production Ready

