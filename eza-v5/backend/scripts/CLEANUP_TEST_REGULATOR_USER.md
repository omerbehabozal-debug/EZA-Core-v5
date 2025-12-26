# Cleanup Test Regulator User

## Disable User (Recommended)

To disable the test regulator user without deleting:

```sql
UPDATE production_users 
SET is_active = false 
WHERE email = 'regulator-test@ezacore.ai';
```

This prevents login while preserving the user record for audit purposes.

## Delete User

To completely remove the test regulator user:

```sql
DELETE FROM production_users 
WHERE email = 'regulator-test@ezacore.ai';
```

**Safety Notes:**
- ✅ User has NO `organization_id` → No cascade deletes
- ✅ User has NO API keys → No cascade deletes
- ✅ User has NO billing relationships → No cascade deletes
- ✅ User has NO organization_users entries → No cascade deletes
- ✅ Safe to delete without affecting other data

## Verification Before Deletion

Check for any dependencies:

```sql
-- Check organization_users
SELECT * FROM production_organization_users 
WHERE user_id = (SELECT id FROM production_users WHERE email = 'regulator-test@ezacore.ai');

-- Check API keys
SELECT * FROM production_api_keys 
WHERE user_id = (SELECT id FROM production_users WHERE email = 'regulator-test@ezacore.ai');

-- Check audit logs (these are safe to keep)
SELECT COUNT(*) FROM production_audit_logs 
WHERE user_id = (SELECT id FROM production_users WHERE email = 'regulator-test@ezacore.ai');
```

If all queries return 0 or empty, the user can be safely deleted.

## Python Script (Alternative)

You can also use Python to disable/delete:

```python
import asyncio
from backend.core.utils.dependencies import AsyncSessionLocal
from backend.models.production import User
from sqlalchemy import select

async def disable_test_user():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == 'regulator-test@ezacore.ai')
        )
        user = result.scalar_one_or_none()
        if user:
            user.is_active = False
            await session.commit()
            print("✓ Test regulator user disabled")

# Run: asyncio.run(disable_test_user())
```

