# -*- coding: utf-8 -*-
"""
Production Authentication Service
Bcrypt password hashing and JWT token management
"""

import bcrypt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from jose import jwt

from backend.config import get_settings, resolve_jwt_secret
from backend.models.production import User, Organization, OrganizationUser, production_users_safe_load
from backend.auth.jwt import create_jwt

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def normalize_email(email: str) -> str:
    """Normalize email: lowercase and strip whitespace"""
    return email.strip().lower()


async def create_user(
    db: AsyncSession,
    email: str,
    password: str | None = None,
    role: str = "user",
    is_active: bool = True,
    is_internal_test_user: bool = False,
    public_display_name: str | None = None,
    commit: bool = True,
) -> User:
    """Create a new user. password=None → social-only account (Phase 8.7.1).

    commit=False flushes only (Phase 8.7.2 social txn with identity insert).
    """
    try:
        logger.info(f"[create_user] Step 1: Normalizing email: {email}")
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        logger.info(f"[create_user] Step 2: Normalized email: {normalized_email}")
        
        # Check if user already exists
        logger.info(f"[create_user] Step 3: Checking if user already exists...")
        result = await db.execute(
            select(User).options(production_users_safe_load()).where(User.email == normalized_email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.warning(f"[create_user] User already exists: {normalized_email}")
            raise ValueError(f"User with email {normalized_email} already exists")
        logger.info(f"[create_user] Step 4: User does not exist, proceeding...")
        
        password_hash = None
        if password is not None and str(password):
            logger.info(f"[create_user] Step 5: Hashing password...")
            password_hash = hash_password(password)
            logger.info(f"[create_user] Step 6: Password hashed. Length: {len(password_hash)}")
        else:
            logger.info(f"[create_user] Step 5-6: Social-only user (no password hash)")
        
        # Create user
        logger.info(f"[create_user] Step 7: Creating User object...")
        user = User(
            email=normalized_email,
            password_hash=password_hash,
            role=role,
            is_active=is_active,
            is_internal_test_user=is_internal_test_user,
            public_display_name=public_display_name,
        )
        logger.info(f"[create_user] Step 8: Adding user to database session...")
        db.add(user)
        if commit:
            logger.info(f"[create_user] Step 9: Committing to database...")
            await db.commit()
            logger.info(f"[create_user] Step 10: Refreshing user from database...")
            await db.refresh(user)
        else:
            logger.info(f"[create_user] Step 9-10: Flush only (deferred commit)...")
            await db.flush()
        logger.info(f"[create_user] Step 11: User id: {user.id}")
        
        if commit and password_hash and password:
            test_verify = verify_password(password, user.password_hash or "")
            if not test_verify:
                logger.error(f"[create_user] CRITICAL: Password hash verification failed!")
        
        logger.info(f"[create_user] ✓ Created user: {normalized_email} with role {role}, ID: {user.id}")
        return user
    except ValueError:
        # Re-raise ValueError as-is
        raise
    except Exception as e:
        logger.exception(f"[create_user] ✗ Error creating user: {e}")
        raise


_AUTH_USER_SQL = text(
    """
    SELECT id, email, password_hash, role, is_active
    FROM production_users
    WHERE lower(email) = :email
    LIMIT 1
    """
)


async def load_user_for_auth(db: AsyncSession, email: str) -> Optional[User]:
    """Load login fields without SELECT * — skips unmigrated honorific."""
    normalized_email = normalize_email(email)
    result = await db.execute(_AUTH_USER_SQL, {"email": normalized_email})
    row = result.mappings().first()
    if row is None:
        return None
    # Pass id in the constructor so JWT sub is the DB id, not a new uuid4.
    return User(
        id=row["id"],
        email=row["email"],
        password_hash=row["password_hash"],
        role=row["role"],
        is_active=True if row["is_active"] is None else bool(row["is_active"]),
    )


_SESSION_USER_SQLS = (
    text(
        """
        SELECT id, email, role, is_active, mirror_plan, account_tier,
               public_display_name, public_avatar_url, public_avatar_revision
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
    text(
        """
        SELECT id, email, role, is_active, mirror_plan, account_tier, public_display_name, public_avatar_url
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
    text(
        """
        SELECT id, email, role, is_active, mirror_plan, account_tier, public_display_name
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
    text(
        """
        SELECT id, email, role, is_active, mirror_plan, public_display_name
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
    text(
        """
        SELECT id, email, role, is_active, mirror_plan
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
    text(
        """
        SELECT id, email, role, is_active
        FROM production_users
        WHERE id = :id
        LIMIT 1
        """
    ),
)


async def load_user_session_row(db: AsyncSession, user_id: str) -> Optional[Dict[str, Any]]:
    """Load /me fields without SELECT * or unmigrated columns."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    last_error: Exception | None = None
    for sql in _SESSION_USER_SQLS:
        try:
            result = await db.execute(sql, {"id": uid})
            row = result.mappings().first()
            return dict(row) if row else None
        except Exception as exc:
            last_error = exc
            logger.warning("session_user_lookup_fallback: %s", exc)
            try:
                await db.rollback()
            except Exception:
                pass
    if last_error:
        raise last_error
    return None


_ENSURE_DISPLAY_NAME_SQL = text(
    "ALTER TABLE production_users ADD COLUMN IF NOT EXISTS public_display_name VARCHAR(48)"
)

_UPDATE_DISPLAY_NAME_SQL = text(
    """
    UPDATE production_users
    SET public_display_name = :name
    WHERE id = :id
    RETURNING id
    """
)


async def _execute_public_display_name_update(
    db: AsyncSession, uid, name: str
) -> bool:
    result = await db.execute(_UPDATE_DISPLAY_NAME_SQL, {"name": name, "id": uid})
    row = result.first()
    await db.commit()
    return row is not None


async def update_public_display_name(db: AsyncSession, user_id: str, name: str) -> bool:
    """Persist public display name without ORM SELECT * / refresh."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    try:
        return await _execute_public_display_name_update(db, uid, name)
    except Exception:
        logger.exception("public_display_name_update_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(_ENSURE_DISPLAY_NAME_SQL)
        await db.commit()
        return await _execute_public_display_name_update(db, uid, name)


_ENSURE_AVATAR_URL_SQL = text(
    "ALTER TABLE production_users ADD COLUMN IF NOT EXISTS public_avatar_url VARCHAR(512)"
)

_UPDATE_AVATAR_URL_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_url = :url
    WHERE id = :id
    RETURNING id
    """
)

_CLEAR_AVATAR_URL_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_url = NULL
    WHERE id = :id
    RETURNING id
    """
)


async def _execute_public_avatar_url_update(
    db: AsyncSession, uid, url: str
) -> bool:
    result = await db.execute(_UPDATE_AVATAR_URL_SQL, {"url": url, "id": uid})
    row = result.first()
    await db.commit()
    return row is not None


async def update_public_avatar_url(db: AsyncSession, user_id: str, url: str) -> bool:
    """Persist public avatar URL without ORM SELECT * / refresh."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    try:
        return await _execute_public_avatar_url_update(db, uid, url)
    except Exception:
        logger.exception("public_avatar_url_update_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(_ENSURE_AVATAR_URL_SQL)
        await db.commit()
        return await _execute_public_avatar_url_update(db, uid, url)


async def clear_public_avatar_url(db: AsyncSession, user_id: str) -> bool:
    """Remove public avatar URL from user row."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    try:
        result = await db.execute(_CLEAR_AVATAR_URL_SQL, {"id": uid})
        row = result.first()
        await db.commit()
        return row is not None
    except Exception:
        logger.exception("public_avatar_url_clear_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(_ENSURE_AVATAR_URL_SQL)
        await db.commit()
        result = await db.execute(_CLEAR_AVATAR_URL_SQL, {"id": uid})
        row = result.first()
        await db.commit()
        return row is not None


_ENSURE_AVATAR_BLOB_DATA_SQL = text(
    "ALTER TABLE production_users ADD COLUMN IF NOT EXISTS public_avatar_data BYTEA"
)

_ENSURE_AVATAR_BLOB_MIME_SQL = text(
    "ALTER TABLE production_users ADD COLUMN IF NOT EXISTS public_avatar_mime VARCHAR(32)"
)

_UPDATE_AVATAR_BLOB_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_data = :data, public_avatar_mime = :mime
    WHERE id = :id
    RETURNING id
    """
)

_CLEAR_AVATAR_BLOB_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_data = NULL, public_avatar_mime = NULL
    WHERE id = :id
    RETURNING id
    """
)

_LOAD_AVATAR_BLOB_SQL = text(
    """
    SELECT public_avatar_data, public_avatar_mime
    FROM production_users
    WHERE id = :id
    LIMIT 1
    """
)


async def update_public_avatar_blob(
    db: AsyncSession, user_id: str, data: bytes, mime: str
) -> bool:
    """Persist avatar bytes in PostgreSQL (durable across deploys)."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    if not data:
        return False
    try:
        result = await db.execute(
            _UPDATE_AVATAR_BLOB_SQL, {"id": uid, "data": data, "mime": mime}
        )
        row = result.first()
        await db.commit()
        return row is not None
    except Exception:
        logger.exception("public_avatar_blob_update_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(_ENSURE_AVATAR_BLOB_DATA_SQL)
        await db.execute(_ENSURE_AVATAR_BLOB_MIME_SQL)
        await db.commit()
        result = await db.execute(
            _UPDATE_AVATAR_BLOB_SQL, {"id": uid, "data": data, "mime": mime}
        )
        row = result.first()
        await db.commit()
        return row is not None


async def clear_public_avatar_blob(db: AsyncSession, user_id: str) -> bool:
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    try:
        result = await db.execute(_CLEAR_AVATAR_BLOB_SQL, {"id": uid})
        row = result.first()
        await db.commit()
        return row is not None
    except Exception:
        logger.exception("public_avatar_blob_clear_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await db.execute(_ENSURE_AVATAR_BLOB_DATA_SQL)
        await db.execute(_ENSURE_AVATAR_BLOB_MIME_SQL)
        await db.commit()
        result = await db.execute(_CLEAR_AVATAR_BLOB_SQL, {"id": uid})
        row = result.first()
        await db.commit()
        return row is not None


async def load_public_avatar_blob(
    db: AsyncSession, user_id: str
) -> tuple[bytes, str] | None:
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    try:
        result = await db.execute(_LOAD_AVATAR_BLOB_SQL, {"id": uid})
        row = result.first()
    except Exception:
        logger.exception("public_avatar_blob_load_failed")
        return None
    if row is None:
        return None
    data, mime = row[0], row[1]
    if not data:
        return None
    media_type = str(mime or "").strip() or "image/jpeg"
    return bytes(data), media_type


_ENSURE_AVATAR_REVISION_SQL = text(
    "ALTER TABLE production_users ADD COLUMN IF NOT EXISTS public_avatar_revision BIGINT NOT NULL DEFAULT 0"
)

_SAVE_AVATAR_ATOMIC_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_data = :data,
        public_avatar_mime = :mime,
        public_avatar_url = :url,
        public_avatar_revision = COALESCE(public_avatar_revision, 0) + 1
    WHERE id = :id
    RETURNING public_avatar_url, public_avatar_revision
    """
)

_CLEAR_AVATAR_ATOMIC_SQL = text(
    """
    UPDATE production_users
    SET public_avatar_data = NULL,
        public_avatar_mime = NULL,
        public_avatar_url = NULL,
        public_avatar_revision = COALESCE(public_avatar_revision, 0) + 1
    WHERE id = :id
    RETURNING public_avatar_revision
    """
)


async def _ensure_avatar_revision_column(db: AsyncSession) -> None:
    await db.execute(_ENSURE_AVATAR_REVISION_SQL)
    await db.commit()


async def save_public_avatar_authoritative(
    db: AsyncSession, user_id: str, data: bytes, mime: str, url: str
) -> tuple[str, int] | None:
    """Atomically persist avatar bytes, MIME, URL, and increment revision."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    if not data:
        return None
    try:
        result = await db.execute(
            _SAVE_AVATAR_ATOMIC_SQL,
            {"id": uid, "data": data, "mime": mime, "url": url},
        )
        row = result.first()
        await db.commit()
    except Exception:
        logger.exception("public_avatar_atomic_save_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await _ensure_avatar_revision_column(db)
        result = await db.execute(
            _SAVE_AVATAR_ATOMIC_SQL,
            {"id": uid, "data": data, "mime": mime, "url": url},
        )
        row = result.first()
        await db.commit()
    if row is None:
        return None
    saved_url = str(row[0]).strip()
    revision = int(row[1])
    return saved_url, revision


async def clear_public_avatar_authoritative(db: AsyncSession, user_id: str) -> int | None:
    """Atomically clear avatar fields and increment revision."""
    import uuid

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    try:
        result = await db.execute(_CLEAR_AVATAR_ATOMIC_SQL, {"id": uid})
        row = result.first()
        await db.commit()
    except Exception:
        logger.exception("public_avatar_atomic_clear_retry_after_schema_ensure")
        try:
            await db.rollback()
        except Exception:
            pass
        await _ensure_avatar_revision_column(db)
        result = await db.execute(_CLEAR_AVATAR_ATOMIC_SQL, {"id": uid})
        row = result.first()
        await db.commit()
    if row is None:
        return None
    return int(row[0])


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str
) -> Optional[User]:
    """Authenticate user by email and password"""
    try:
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        user = await load_user_for_auth(db, normalized_email)
        
        if not user:
            logger.debug(f"Authentication failed: User not found for email {normalized_email}")
            return None
        
        if not user.password_hash:
            logger.warning(f"[Auth] Authentication failed: social-only user has no password ({normalized_email})")
            return None

        # Verify password
        logger.info(f"[Auth] Verifying password for user: {normalized_email}")
        logger.info(f"[Auth] Password hash length: {len(user.password_hash) if user.password_hash else 0}")
        logger.info(f"[Auth] Password hash starts with: {user.password_hash[:20] if user.password_hash else 'None'}...")
        
        try:
            password_valid = verify_password(password, user.password_hash)
            logger.info(f"[Auth] Password verification result: {password_valid}")
        except Exception as verify_err:
            logger.error(f"[Auth] Password verification exception: {verify_err}")
            logger.error(f"[Auth] Hash format may be invalid. Hash: {user.password_hash[:50] if user.password_hash else 'None'}...")
            return None
        
        if not password_valid:
            logger.warning(f"[Auth] Authentication failed: Invalid password for email {normalized_email}")
            logger.warning(f"[Auth] Password verification failed - hash may be incorrect or password doesn't match")
            logger.warning(f"[Auth] Consider using password reset endpoint to set a new password")
            return None
        
        # Check if user is active
        is_active = getattr(user, 'is_active', True)  # Default to True for backward compatibility
        if not is_active:
            logger.warning(f"[Auth] Authentication failed: User account is inactive for email {normalized_email}")
            return None
        
        logger.info(f"Authentication successful for user: {normalized_email} (role: {user.role}, is_active: {is_active})")
        return user
    except Exception as e:
        logger.exception(f"Authentication error for {email}: {e}")
        return None


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get user by UUID"""
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    
    result = await db.execute(
        select(User).options(production_users_safe_load()).where(User.id == user_uuid)
    )
    return result.scalar_one_or_none()


async def reset_user_password(
    db: AsyncSession,
    email: str,
    new_password: str
) -> bool:
    """Reset user password by email"""
    try:
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        
        # Try exact match first (for normalized emails)
        result = await db.execute(
            select(User).options(production_users_safe_load()).where(User.email == normalized_email)
        )
        user = result.scalar_one_or_none()
        
        # If not found, try case-insensitive search (for legacy emails)
        if not user:
            result = await db.execute(
                select(User)
                .options(production_users_safe_load())
                .where(func.lower(User.email) == normalized_email)
            )
            user = result.scalar_one_or_none()
            
            # If found with case-insensitive, update to normalized email
            if user:
                logger.info(f"Found user with case-insensitive match for password reset, updating email to normalized: {normalized_email}")
                user.email = normalized_email
        
        if not user:
            logger.warning(f"Password reset failed: User not found for email {normalized_email}")
            return False
        
        # Hash the new password
        new_hash = hash_password(new_password)
        logger.debug(f"Password reset: Generated hash for {normalized_email} (length: {len(new_hash)})")
        
        # Store old hash for comparison
        old_hash = user.password_hash
        
        # Update password hash
        user.password_hash = new_hash
        await db.commit()
        await db.refresh(user)
        
        # Verify the password was actually updated
        if user.password_hash == old_hash:
            logger.error(f"Password reset failed: Hash did not change for {normalized_email}")
            await db.rollback()
            return False
        
        # Test password verification
        if verify_password(new_password, user.password_hash):
            logger.info(f"Password reset successful for user: {normalized_email}")
            return True
        else:
            logger.error(f"Password reset failed: Verification failed for {normalized_email}")
            await db.rollback()
            return False
    except Exception as e:
        logger.exception(f"Password reset error for {email}: {e}")
        await db.rollback()
        return False


async def check_bootstrap_allowed(db: AsyncSession) -> bool:
    """Check if bootstrap is allowed (no users or orgs exist)"""
    # Check if any users exist
    result = await db.execute(select(User.id).limit(1))
    has_users = result.scalar_one_or_none() is not None
    
    # Check if any organizations exist
    result = await db.execute(select(Organization).limit(1))
    has_orgs = result.scalar_one_or_none() is not None
    
    # Bootstrap allowed only if no users AND no orgs
    return not has_users and not has_orgs


def create_access_token(user: User, expires_in_hours: int = 8) -> str:
    """Create JWT access token for user"""
    try:
        settings = get_settings()
        jwt_secret = resolve_jwt_secret(settings)
        logger.debug(f"Using JWT_SECRET (length: {len(jwt_secret) if jwt_secret else 0})")
        
        expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
        
        payload = {
            "sub": str(user.id),  # UUID as string
            "user_id": str(user.id),
            "role": user.role,
            "email": user.email,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        try:
            encoded_jwt = jwt.encode(
                payload,
                jwt_secret,
                algorithm="HS256"
            )
            logger.debug(f"JWT token created for user {user.id} with role {user.role} (token length: {len(encoded_jwt)})")
            return encoded_jwt
        except Exception as encode_error:
            logger.error(f"JWT encode error: {encode_error}")
            logger.error(f"Payload: {payload}")
            logger.error(f"JWT Secret length: {len(jwt_secret) if jwt_secret else 0}")
            raise ValueError(f"Failed to encode JWT token: {str(encode_error)}")
    except RuntimeError:
        raise
    except ValueError:
        # Re-raise ValueError as-is
        raise
    except Exception as e:
        logger.exception(f"Error creating access token: {e}")
        raise ValueError(f"Failed to create access token: {str(e)}")

