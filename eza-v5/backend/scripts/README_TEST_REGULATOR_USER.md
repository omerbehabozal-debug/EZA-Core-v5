# Test Regulator User - Creation & Validation

## Overview

This document describes the test regulator user created for internal testing of the Regulator Oversight Panel.

## User Specification

- **Email**: `regulator-test@ezacore.ai`
- **Role**: `REGULATOR_AUDITOR`
- **Is Active**: `true`
- **Is Internal Test User**: `true`
- **Organization ID**: `None` (no organization assigned)
- **API Key**: `None` (no API key generated)
- **Billing**: `None` (no billing relationship)

## Creation

### Step 1: Create User

```bash
cd eza-v5/backend
python scripts/create_test_regulator_user.py
```

This script:
1. Adds `is_active` and `is_internal_test_user` columns if they don't exist
2. Creates the test user with a strong random password
3. Displays the password (save it securely!)

### Step 2: Validate User

```bash
python scripts/validate_test_regulator_user.py
```

This validates:
- User exists
- Role is correct
- Is active
- No organization assigned
- No API keys

## Access Control

### ✅ Allowed Access

- **Login**: `https://regulator.ezacore.ai/login`
- **Dashboard**: Regulator dashboard (read-only)
- **API Calls**: GET requests only
- **Endpoints**: 
  - `GET /api/proxy/audit/search`
  - `GET /api/proxy/audit`

### ❌ Blocked Access

- **Platform Panel**: `https://platform.ezacore.ai` → 403 Forbidden
- **Proxy Panel**: `https://proxy.ezacore.ai` → 403 Forbidden
- **Admin Panel**: `https://admin.ezacore.ai` → 403 Forbidden
- **Write Operations**: POST/PATCH/DELETE → Blocked by API client
- **Analysis Endpoints**: `/api/proxy/analyze`, `/api/proxy/rewrite` → Blocked
- **Content Bodies**: Never displayed (frontend enforcement)

## Security Enforcement

### Backend (`proxy_auth_production.py`)

- Regulator roles (`REGULATOR_READONLY`, `REGULATOR_AUDITOR`) bypass organization check
- Regulator roles bypass API key check
- Non-GET methods are blocked for regulators (403 Forbidden)
- Only GET and OPTIONS methods allowed

### Frontend (`apps/regulator/lib/api-client.ts`)

- GET-only API client
- POST/PATCH/DELETE blocked at runtime
- Analyze/Proxy/Rewrite endpoints blocked
- Only authentication endpoints allow POST

## Cleanup

### Disable User

```sql
UPDATE production_users 
SET is_active = false 
WHERE email = 'regulator-test@ezacore.ai';
```

### Delete User

```sql
DELETE FROM production_users 
WHERE email = 'regulator-test@ezacore.ai';
```

**Note**: Since the user has no organization_id, API keys, or billing relationships, deletion is safe.

## Database Schema Changes

The following columns were added to `production_users`:

- `is_active` (BOOLEAN, NOT NULL, DEFAULT true)
- `is_internal_test_user` (BOOLEAN, DEFAULT false)

These are added automatically on application startup via `init_db()` in `backend/core/utils/dependencies.py`.

## Testing Checklist

After creating the user, verify:

- [ ] User can log in at `https://regulator.ezacore.ai/login`
- [ ] User is redirected to regulator dashboard
- [ ] Attempts to access `/proxy` result in 403 Forbidden
- [ ] Attempts to access `/platform` result in 403 Forbidden
- [ ] Attempts to access `/admin` result in 403 Forbidden
- [ ] All API calls from regulator UI are GET-only
- [ ] No content bodies are displayed
- [ ] Organization masking works correctly

## Important Notes

1. **No Self-Signup**: This user was created manually via script
2. **No Password Reset**: Password reset requests require manual approval
3. **Read-Only**: User cannot create, update, or delete anything
4. **No Content Access**: User cannot see content bodies, prompts, or rewritten text
5. **Observational Only**: User observes system behavior, does not participate

## Strategic Principle

> "Regulators are observers, not participants. This test user exists only to validate observability — not control."

