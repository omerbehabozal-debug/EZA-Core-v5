"""
READ-ONLY verify step for first BiligN platform admin bootstrap.

Does NOT grant capability. Does NOT change EZA role.
Target candidate (ops confirmation required before grant): omerbehabozal@gmail.com

Usage:
  DATABASE_URL=... python -m backend.scripts._ops_bilign_admin_bootstrap_verify
"""
from __future__ import annotations

import asyncio
import os
import sys

import asyncpg

TARGET_EMAIL = os.environ.get('BILIGN_BOOTSTRAP_EMAIL', 'omerbehabozal@gmail.com').strip().lower()
CAPABILITY = 'bilign.platform_admin'


async def main() -> int:
    raw = os.environ.get('DATABASE_URL')
    if not raw:
        print('FAIL missing DATABASE_URL')
        return 2
    url = raw.replace('postgresql+asyncpg://', 'postgresql://').replace('postgres://', 'postgresql://')
    conn = await asyncpg.connect(url)
    try:
        user = await conn.fetchrow(
            """
            select id::text, email, role, is_active
            from production_users
            where lower(email)=lower($1)
            """,
            TARGET_EMAIL,
        )
        if not user:
            print('FAIL user_not_found', TARGET_EMAIL)
            return 1
        print('FOUND', dict(user))
        if not user['is_active']:
            print('FAIL user_inactive')
            return 1
        active = await conn.fetchval(
            """
            select id::text from user_capabilities
            where user_id=$1::uuid and capability=$2 and revoked_at is null
            """,
            user['id'],
            CAPABILITY,
        )
        print('ACTIVE_CAPABILITY', bool(active), active)
        print('EZA_ROLE_UNCHANGED_PLAN', user['role'])
        print(
            'NEXT_GRANT_SQL_TEMPLATE',
            (
                "INSERT INTO user_capabilities "
                "(id, user_id, capability, granted_at, granted_by, revoked_at, revoked_by) "
                "SELECT gen_random_uuid(), id, 'bilign.platform_admin', now(), NULL, NULL, NULL "
                f"FROM production_users WHERE id='{user['id']}'::uuid "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM user_capabilities uc "
                "  WHERE uc.user_id=production_users.id "
                "    AND uc.capability='bilign.platform_admin' "
                "    AND uc.revoked_at IS NULL"
                ");"
            ),
        )
        print('NOTE grant requires explicit operator approval; do not run from this script.')
        return 0
    finally:
        await conn.close()


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
