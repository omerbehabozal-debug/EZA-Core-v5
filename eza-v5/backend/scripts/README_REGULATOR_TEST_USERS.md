# Regulator Test Users - Creation Script

## Overview

This script creates production-safe internal test regulator users for all regulator panels.

## Users Created

| Panel | Email | Role | Domain |
|-------|-------|------|--------|
| RTÜK | `rtuk-test@ezacore.ai` | `REGULATOR_RTUK` | `rtuk.ezacore.ai` |
| Sanayi | `tech-test@ezacore.ai` | `REGULATOR_SANAYI` | `sanayi.ezacore.ai` |
| Finance | `finance-test@ezacore.ai` | `REGULATOR_FINANCE` | `finance.ezacore.ai` |
| Health | `health-test@ezacore.ai` | `REGULATOR_HEALTH` | `health.ezacore.ai` |

## Common Password

All test users share the same password:
```
Ez@Core-Test-2025
```

## Usage

### Important: Database Selection

⚠️ **CRITICAL**: The script uses `DATABASE_URL` from your `.env` file. Make sure you're connecting to the **correct database**:

- **Local Development**: Uses `localhost:5432/eza_v6` (default)
- **Production**: Must use Railway production database URL

### From Project Root

```bash
cd eza-v5/backend
python scripts/create_regulator_test_users.py
```

### From Backend Directory

```bash
python scripts/create_regulator_test_users.py
```

### For Production Database

1. **Get Railway Production DATABASE_URL**:
   - Railway Dashboard → Your Project → PostgreSQL → Connect → Connection URL
   - Copy the **PUBLIC** connection URL (NOT internal)

2. **Set DATABASE_URL in .env**:
   ```bash
   DATABASE_URL=postgresql://postgres:password@host:port/database
   ```

3. **Run script**:
   ```bash
   python scripts/create_regulator_test_users.py
   ```

### Verify Users

After creating users, verify they exist in the correct database:

```bash
python scripts/verify_regulator_test_users.py
```

## Features

✅ **Idempotent**: Safe to run multiple times - won't create duplicates  
✅ **Production-Safe**: Only creates/updates test users, never affects real users  
✅ **Auto-Update**: Updates existing users if role/flags don't match  
✅ **Skip Logic**: Skips users that already have correct settings  

## User Properties

All created users have:
- `is_active = True`
- `is_internal_test_user = True`
- `role = <REGULATOR_ROLE>`
- `password_hash = <hashed password>`
- `organization_id = None` (no organization assigned)
- `api_keys = []` (no API keys)
- `billing = None` (no billing relationship)

## Script Behavior

### If User Exists

1. **Check if user has correct role and flags**
   - If YES → **SKIPPED** (no changes made)
   - If NO → **UPDATED** (role, flags, and password updated)

### If User Doesn't Exist

- **CREATED** (new user created with all properties)

## Output

The script prints:
- Status for each user (CREATED / UPDATED / SKIPPED)
- Summary with counts
- User credentials table
- Access information

## Security

⚠️ **IMPORTANT:**
- These are internal test users for development/testing only
- Password is shared across all test users
- Change password after first login if needed
- These users are read-only (GET-only API access)
- Script is idempotent - safe to run multiple times

## Troubleshooting

### Database Connection Error

Ensure `DATABASE_URL` is set in `.env`:
```bash
DATABASE_URL=postgresql+asyncpg://user:password@host:port/database
```

### Permission Error

Ensure the database user has CREATE/UPDATE permissions on `production_users` table.

### Column Missing Error

The script automatically adds `is_active` and `is_internal_test_user` columns if they don't exist.

## Example Output

```
================================================================================
REGULATOR TEST USERS CREATION
================================================================================

Common Password: Ez@Core-Test-2025
Total Users: 4

--------------------------------------------------------------------------------

[RTÜK] Processing: rtuk-test@ezacore.ai
  Role: REGULATOR_RTUK
  Panel: rtuk.ezacore.ai
  ✓ CREATED - User ID: 123e4567-e89b-12d3-a456-426614174000

[SANAYI / AI] Processing: tech-test@ezacore.ai
  Role: REGULATOR_SANAYI
  Panel: sanayi.ezacore.ai
  ✓ CREATED - User ID: 123e4567-e89b-12d3-a456-426614174001

...

================================================================================
SUMMARY
================================================================================

✓ Created: 4
✓ Updated: 0
⊘ Skipped: 0
  Total: 4

================================================================================
✅ COMPLETED
================================================================================
```

