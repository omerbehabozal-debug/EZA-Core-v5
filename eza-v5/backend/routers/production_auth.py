# -*- coding: utf-8 -*-
"""
Production Authentication Router
Register, Login, Logout endpoints
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.services.production_auth import (
    create_user, authenticate_user, create_access_token, check_bootstrap_allowed,
    hash_password, reset_user_password, normalize_email, load_user_session_row,
    update_public_display_name,
    save_public_avatar_authoritative,
    clear_public_avatar_authoritative,
)
from backend.models.production import User, production_users_safe_load
from backend.auth.deps import get_current_user
from backend.auth.mirror_entitlement import normalize_mirror_plan
from backend.core.account.tiers import resolve_user_account_tier
from sqlalchemy import select, func
from backend.services.production_org import create_organization
from backend.config import get_settings
from backend.security.production_surface import (
    assert_non_production_surface,
    is_production_runtime,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"  # admin, org_admin, user, ops, regulator (ignored if invitation_token provided)
    full_name: str | None = None  # Optional; when valid, stored as public_display_name (Phase 8.5)
    invitation_token: str | None = None  # Optional invitation token for enterprise flow


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    email: str


class LogoutRequest(BaseModel):
    pass  # JWT is stateless, logout is client-side (token removal)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str


class AuthMeResponse(BaseModel):
    user_id: str
    email: str
    role: str
    mirror_plan: str
    account_tier: str | None = None
    # Phase 8.5 — owner-private identity control (not a public DTO).
    public_display_name: str | None = None
    public_avatar_url: str | None = None
    public_avatar_revision: int = 0
    # Public honorific id (curious | bilgin). Not a plan/role. Owner session only.
    public_honorific: str


class PublicIdentityUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    public_display_name: str
    # public_honorific / publicHonorific are forbidden extras — owner cannot self-assign.


class PublicIdentityUpdateResponse(BaseModel):
    public_display_name: str
    resolved_public_display_name: str


class PublicAvatarUpdateResponse(BaseModel):
    public_avatar_url: str
    public_avatar_revision: int


class PublicAvatarDeleteResponse(BaseModel):
    ok: bool = True
    public_avatar_revision: int


class SocialGoogleRequest(BaseModel):
    id_token: str


class SocialAppleRequest(BaseModel):
    id_token: str
    state: str
    # First Apple authorization may include name — never used as public display name (8.7.2).
    full_name: str | None = None


class SocialAppleStartRequest(BaseModel):
    return_path: str | None = None


class SocialAppleStartResponse(BaseModel):
    state: str
    nonce: str
    clientId: str
    redirectUri: str


class SocialAppleCancelRequest(BaseModel):
    state: str


class SocialCapabilitiesResponse(BaseModel):
    googleEnabled: bool
    appleEnabled: bool
    googleClientId: str | None = None
    appleClientId: str | None = None
    appleRedirectUri: str | None = None


def _optional_explicit_public_name(raw: str | None) -> str | None:
    """Register-time optional name — invalid values are ignored (do not fail register)."""
    if raw is None or not str(raw).strip():
        return None
    try:
        from backend.services.mirror_network.public_identity import validate_public_display_name

        return validate_public_display_name(raw)
    except ValueError:
        return None


@router.get("/me", response_model=AuthMeResponse)
async def get_auth_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current authenticated user profile including Mirror entitlement plan."""
    row = await load_user_session_row(db, current_user["user_id"])
    is_active = True if not row else row.get("is_active")
    if row is None or is_active is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_required",
                "message": "User not found or inactive",
            },
        )
    chosen = row.get("public_display_name")
    from backend.services.mirror_network.public_identity import normalize_public_honorific

    return AuthMeResponse(
        user_id=str(row["id"]),
        email=row["email"],
        role=row["role"],
        mirror_plan=normalize_mirror_plan(row.get("mirror_plan") or "free"),
        account_tier=resolve_user_account_tier(
            mirror_plan=row.get("mirror_plan") or "free",
            account_tier=row.get("account_tier"),
            is_authenticated=True,
        ).value,
        public_display_name=(str(chosen).strip() if chosen else None) or None,
        public_avatar_url=(
            str(row["public_avatar_url"]).strip()
            if row.get("public_avatar_url")
            else None
        )
        or None,
        public_avatar_revision=int(row.get("public_avatar_revision") or 0),
        public_honorific=normalize_public_honorific(None),
    )


@router.patch("/me/public-identity", response_model=PublicIdentityUpdateResponse)
async def patch_public_identity(
    body: PublicIdentityUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 8.5 — authenticated owner sets explicit public display name.

    Never derives from email. Logs event without private name payloads.
    Honorific is not writable here (system-granted Bilgin only).
    """
    from backend.services.mirror_network.public_identity import (
        resolve_public_display_name,
        validate_public_display_name,
    )
    from types import SimpleNamespace

    row = await load_user_session_row(db, current_user["user_id"])
    if row is None or row.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth_required", "message": "User not found or inactive"},
        )
    try:
        validated = validate_public_display_name(body.public_display_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": str(exc), "message": "Invalid public display name"},
        ) from exc

    updated = await update_public_display_name(db, str(row["id"]), validated)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "public_identity_update_failed", "message": "Public name was not saved"},
        )
    logger.info("public_profile_updated user_id=%s", row["id"])
    return PublicIdentityUpdateResponse(
        public_display_name=validated,
        resolved_public_display_name=resolve_public_display_name(
            SimpleNamespace(public_display_name=validated)
        ),
    )


@router.post("/me/avatar", response_model=PublicAvatarUpdateResponse)
async def upload_public_avatar(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload or replace the authenticated user's public profile avatar."""
    from backend.services.profile_avatar_store import (
        MAX_PROFILE_AVATAR_BYTES,
        save_profile_avatar_bytes,
    )

    row = await load_user_session_row(db, current_user["user_id"])
    if row is None or row.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth_required", "message": "User not found or inactive"},
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "avatar_empty", "message": "Empty file"},
        )
    if len(raw) > MAX_PROFILE_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "avatar_too_large", "message": "Avatar exceeds size limit"},
        )

    try:
        public_url, normalized_bytes, normalized_mime = save_profile_avatar_bytes(
            raw, str(row["id"])
        )
    except ValueError as exc:
        code = str(exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": code, "message": "Unsupported avatar image"},
        ) from exc

    blob_saved = await save_public_avatar_authoritative(
        db, str(row["id"]), normalized_bytes, normalized_mime, public_url
    )
    if not blob_saved:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "avatar_update_failed", "message": "Avatar was not saved"},
        )
    saved_url, revision = blob_saved
    logger.info("public_avatar_updated user_id=%s revision=%s", row["id"], revision)
    return PublicAvatarUpdateResponse(
        public_avatar_url=saved_url,
        public_avatar_revision=revision,
    )


@router.delete("/me/avatar", response_model=PublicAvatarDeleteResponse)
async def delete_public_avatar(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the authenticated user's public profile avatar."""
    from backend.services.profile_avatar_store import delete_profile_avatar_files

    row = await load_user_session_row(db, current_user["user_id"])
    if row is None or row.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "auth_required", "message": "User not found or inactive"},
        )

    delete_profile_avatar_files(str(row["id"]))
    revision = await clear_public_avatar_authoritative(db, str(row["id"]))
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "avatar_clear_failed", "message": "Avatar was not removed"},
        )
    logger.info("public_avatar_removed user_id=%s revision=%s", row["id"], revision)
    return PublicAvatarDeleteResponse(ok=True, public_avatar_revision=revision)


@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user (Enterprise/SOC2/ISO compliant)
    
    Two flows:
    1. With invitation_token: Validates invitation, creates User + OrganizationUser
    2. Without invitation_token: Normal standalone registration (bootstrap or admin-only)
    """
    normalized_email = normalize_email(request.email)
    
    # Flow 1: Invitation-based registration (Enterprise/SOC2/ISO compliant)
    if request.invitation_token:
        logger.info(f"[Register] Step 1: Invitation-based registration for email: {normalized_email}")
        
        from backend.services.production_invitation import validate_invitation_token, accept_invitation
        
        # Validate invitation token
        is_valid, error_message, invitation = await validate_invitation_token(db, request.invitation_token)
        
        if not is_valid or not invitation:
            logger.warning(f"[Register] Invalid invitation token: {error_message}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message or "Invalid invitation token"
            )
        
        # Verify email matches invitation
        if normalize_email(invitation.email) != normalized_email:
            logger.warning(f"[Register] Email mismatch: invitation={invitation.email}, provided={normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email does not match invitation"
            )
        
        # Check if user already exists
        result = await db.execute(select(User).options(production_users_safe_load()).where(User.email == normalized_email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # User exists - check if already in organization
            from backend.models.production import OrganizationUser
            from sqlalchemy import and_
            org_user_check = await db.execute(
                select(OrganizationUser).where(
                    and_(
                        OrganizationUser.org_id == invitation.organization_id,
                        OrganizationUser.user_id == existing_user.id
                    )
                )
            )
            if org_user_check.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User is already a member of this organization"
                )
            
            # Update password
            from backend.services.production_auth import hash_password
            existing_user.password_hash = hash_password(request.password)
            await db.commit()
            await db.refresh(existing_user)
            user = existing_user
        else:
            # Create new user with role from invitation
            user = await create_user(
                db=db,
                email=request.email,
                password=request.password,
                role="user",  # Default role, actual role comes from OrganizationUser
                public_display_name=_optional_explicit_public_name(request.full_name),
            )
        
        # Accept invitation and create OrganizationUser
        org_user = await accept_invitation(db, invitation, str(user.id))
        
        logger.info(f"[Register] Step 2: User registered via invitation. User ID: {user.id}, Org: {invitation.organization_id}, Role: {org_user.role}")
        
        # Create JWT token
        access_token = create_access_token(user)
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=org_user.role,  # Use role from OrganizationUser
            email=user.email
        )
    
    # Flow 2: Standalone registration (bootstrap or admin-only)
    logger.info(f"[Register] Step 1: Standalone registration for email: {normalized_email}, role: {request.role}")
    
    # Check if bootstrap allowed
    is_bootstrap = await check_bootstrap_allowed(db)
    
    # Determine final role
    final_role = request.role
    
    # In bootstrap mode, first user MUST be admin
    if is_bootstrap:
        if request.role not in ["admin", "org_admin"]:
            logger.warning(f"[Register] Bootstrap mode: Forcing role to 'admin' (requested: {request.role})")
            final_role = "admin"
    else:
        # Not bootstrap mode: Only existing admins can create admin users
        if request.role in ["admin", "org_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only existing admins can create admin users. Use bootstrap mode for first admin."
            )
    
    try:
        # Check if user already exists
        result = await db.execute(select(User).options(production_users_safe_load()).where(User.email == normalized_email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists. Use invitation flow or login."
            )
        
        logger.info(f"[Register] Step 2: Creating new user...")
        explicit_name = _optional_explicit_public_name(request.full_name)
        user = await create_user(
            db=db,
            email=request.email,
            password=request.password,
            role=final_role,
            public_display_name=explicit_name,
        )
        logger.info(f"[Register] Step 3: User created successfully. User ID: {user.id}, Email: {user.email}")
        
        # Immediately test login with the same credentials
        logger.info(f"[Register] Step 4: Testing login immediately after registration...")
        test_user = await authenticate_user(db, request.email, request.password)
        if test_user:
            logger.info(f"[Register] Step 5: ✓ Login test successful immediately after registration")
        else:
            logger.error(f"[Register] Step 5: ✗ CRITICAL: Login test FAILED immediately after registration!")
            logger.error(f"[Register] This indicates a password hashing/verification issue")
        
        # Create JWT token
        logger.info(f"[Register] Step 6: Creating JWT access token...")
        try:
            access_token = create_access_token(user)
            logger.info(f"[Register] Step 7: JWT token created successfully (length: {len(access_token)})")
        except Exception as jwt_error:
            logger.error(f"[Register] Step 7: ✗ JWT token creation failed: {jwt_error}")
            raise
        
        logger.info(f"[Register] Step 8: Preparing response...")
        response = TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=user.role,
            email=user.email
        )
        logger.info(f"[Register] Step 9: ✓ Registration completed successfully for {user.email} (role: {user.role})")
        return response
    except ValueError as e:
        logger.error(f"Register validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"Register error: {e}")
        logger.error(f"Register error traceback: {error_trace}")
        # Return more detailed error in development, generic in production
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Registration failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """User login with email and password"""
    try:
        normalized_email = normalize_email(request.email)
        logger.info(f"[Login] Step 1: Attempting login for email: {normalized_email} (original: {request.email})")
        
        logger.info(f"[Login] Step 2: Authenticating...")
        user = await authenticate_user(db, request.email, request.password)
        
        if not user:
            logger.warning(f"[Login] Step 3: Authentication failed for: {normalized_email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        logger.info(f"[Login] Step 4: Authentication successful. Role: {user.role}")
        logger.info(f"[Login] Step 5: Creating JWT token...")
        
        # Create JWT token
        try:
            access_token = create_access_token(user)
            logger.info(f"[Login] Step 6: JWT token created successfully (length: {len(access_token)})")
        except Exception as jwt_error:
            logger.error(f"[Login] Step 6: ✗ JWT token creation failed: {jwt_error}")
            import traceback
            logger.error(f"[Login] JWT error traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed. Please check server logs."
            )
        
        logger.info(f"[Login] Step 7: ✓ Login successful for: {normalized_email} (role: {user.role})")
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=user.role,
            email=user.email
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"[Login] ✗ Login error: {e}")
        logger.error(f"[Login] Error traceback: {error_trace}")
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Login failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@router.get("/social/capabilities", response_model=SocialCapabilitiesResponse)
async def social_auth_capabilities() -> SocialCapabilitiesResponse:
    """Public: which social providers are configured (client ids only, no secrets)."""
    from backend.services.social_auth import (
        apple_id_token_verify_configured,
        google_oauth_configured,
    )

    settings = get_settings()
    google_on = google_oauth_configured()
    apple_on = apple_id_token_verify_configured()
    return SocialCapabilitiesResponse(
        googleEnabled=google_on,
        appleEnabled=apple_on,
        googleClientId=(settings.GOOGLE_OAUTH_CLIENT_ID or "").strip() or None
        if google_on
        else None,
        appleClientId=(settings.APPLE_CLIENT_ID or "").strip() or None
        if apple_on
        else None,
        appleRedirectUri=(settings.APPLE_REDIRECT_URI or "").strip() or None
        if apple_on
        else None,
    )


@router.post("/social/google", response_model=TokenResponse)
async def social_google(
    request: SocialGoogleRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Google Identity Services id_token → biligN JWT (same TokenResponse as email)."""
    from backend.services.social_auth import (
        SocialAuthError,
        issue_social_token_response,
        resolve_social_user,
        verify_google_id_token,
    )

    try:
        identity = await verify_google_id_token(request.id_token)
        user = await resolve_social_user(db, identity)
        payload = await issue_social_token_response(db, user)
        return TokenResponse(**payload)
    except SocialAuthError as err:
        try:
            from backend.observability.ops_events import emit_ops_event
            from backend.observability import error_codes as ops_codes

            code = (
                ops_codes.ACCOUNT_LINK_REQUIRED
                if err.code == "account_link_required"
                else ops_codes.SOCIAL_AUTH_FAILED
            )
            emit_ops_event(
                "social_auth_failed",
                code=code,
                outcome="failure",
                fields={"provider": "google", "reason": err.code},
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=err.http_status,
            detail={"code": err.code, "message": err.message},
        ) from err
async def social_apple_start(
    request: SocialAppleStartRequest,
    db: AsyncSession = Depends(get_db),
) -> SocialAppleStartResponse:
    """Create server-bound Apple auth attempt (state + nonce)."""
    from backend.services.social_auth import SocialAuthError, create_apple_auth_attempt

    try:
        payload = await create_apple_auth_attempt(db, return_path=request.return_path)
        return SocialAppleStartResponse(**payload)
    except SocialAuthError as err:
        raise HTTPException(
            status_code=err.http_status,
            detail={"code": err.code, "message": err.message},
        ) from err


@router.post("/social/apple/cancel")
async def social_apple_cancel(
    request: SocialAppleCancelRequest,
    db: AsyncSession = Depends(get_db),
):
    """Discard Apple attempt on user cancel (no session issued)."""
    from backend.services.social_auth import discard_apple_auth_attempt

    await discard_apple_auth_attempt(db, request.state)
    return {"ok": True}


@router.post("/social/apple", response_model=TokenResponse)
async def social_apple(
    request: SocialAppleRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Sign in with Apple id_token + server state → biligN JWT."""
    from backend.services.social_auth import (
        SocialAuthError,
        consume_apple_auth_attempt,
        issue_social_token_response,
        resolve_social_user,
        verify_apple_id_token,
    )

    try:
        attempt = await consume_apple_auth_attempt(db, request.state)
        identity = await verify_apple_id_token(
            request.id_token, expected_nonce_hash=attempt.nonce_hash
        )
        user = await resolve_social_user(
            db, identity, apple_name_hint=request.full_name
        )
        payload = await issue_social_token_response(db, user)
        return TokenResponse(**payload)
    except SocialAuthError as err:
        try:
            from backend.observability.ops_events import emit_ops_event
            from backend.observability import error_codes as ops_codes

            code = (
                ops_codes.ACCOUNT_LINK_REQUIRED
                if err.code == "account_link_required"
                else ops_codes.SOCIAL_AUTH_FAILED
            )
            emit_ops_event(
                "social_auth_failed",
                code=code,
                outcome="failure",
                fields={"provider": "apple", "reason": err.code},
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=err.http_status,
            detail={"code": err.code, "message": err.message},
        ) from err


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal)
    
    JWT is stateless, so logout is handled by client removing token.
    This endpoint exists for API contract consistency.
    """
    return {"message": "Logged out successfully"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Dev/CI-only direct password reset (email + new_password).

    Production: route absent (404). No token-based reset lifecycle exists yet;
    real forgot-password flow belongs to a later Phase 8 auth slice.
    """
    assert_non_production_surface(surface="reset-password")
    try:
        logger.info(f"[ResetPassword] Step 1: Starting password reset for email: {request.email}")
        logger.info(f"[ResetPassword] Step 2: Calling reset_user_password...")
        
        success = await reset_user_password(db, request.email, request.new_password)
        
        if not success:
            logger.warning(f"[ResetPassword] Step 3: Password reset failed - user not found or reset failed")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or password reset failed"
            )
        
        logger.info(f"[ResetPassword] Step 3: ✓ Password reset successful for: {request.email}")
        return {"message": "Password reset successfully"}
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"[ResetPassword] ✗ Password reset error: {e}")
        logger.error(f"[ResetPassword] Error traceback: {error_trace}")
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Password reset failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@router.get("/debug/check-email")
async def debug_check_email(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Debug endpoint to check if email exists in database
    Returns email variations found in DB
    """
    assert_non_production_surface(surface="debug/check-email")
    normalized = normalize_email(email)
    
    # Try exact match
    result = await db.execute(select(User).options(production_users_safe_load()).where(User.email == normalized))
    exact_user = result.scalar_one_or_none()
    
    # Try case-insensitive
    result = await db.execute(select(User).options(production_users_safe_load()).where(func.lower(User.email) == normalized))
    case_insensitive_user = result.scalar_one_or_none()
    
    # Get all users (for debugging)
    result = await db.execute(
        select(User.email, User.role, User.created_at)
        .order_by(User.created_at.desc())
        .limit(50)
    )
    all_users = result.all()
    
    # Get total user count
    count_result = await db.execute(select(func.count(User.id)))
    total_users = count_result.scalar() or 0
    
    return {
        "normalized_email": normalized,
        "original_email": email,
        "total_users_in_db": total_users,
        "exact_match": {
            "found": exact_user is not None,
            "email": exact_user.email if exact_user else None,
            "role": exact_user.role if exact_user else None,
            "user_id": str(exact_user.id) if exact_user else None
        },
        "case_insensitive_match": {
            "found": case_insensitive_user is not None,
            "email": case_insensitive_user.email if case_insensitive_user else None,
            "role": case_insensitive_user.role if case_insensitive_user else None,
            "user_id": str(case_insensitive_user.id) if case_insensitive_user else None
        },
        "all_users_in_db": [
            {
                "email": row[0], 
                "role": row[1], 
                "created_at": str(row[2])
            } for row in all_users
        ]
    }


@router.post("/debug/test-login")
async def debug_test_login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Debug endpoint to test login with detailed logging
    """
    assert_non_production_surface(surface="debug/test-login")
    from backend.services.production_auth import authenticate_user, verify_password, normalize_email
    from sqlalchemy import select, func
    
    normalized_email = normalize_email(request.email)
    logger.info(f"[Debug Login] Testing login for: {normalized_email}")
    
    # Find user
    result = await db.execute(select(User).options(production_users_safe_load()).where(func.lower(User.email) == normalized_email))
    user = result.scalar_one_or_none()
    
    if not user:
        return {
            "found": False,
            "error": "User not found",
            "searched_email": normalized_email
        }
    
    # Test password verification
    password_valid = verify_password(request.password, user.password_hash)
    
    return {
        "found": True,
        "email": user.email,
        "role": user.role,
        "user_id": str(user.id),
        "password_hash_length": len(user.password_hash) if user.password_hash else 0,
        "password_hash_preview": user.password_hash[:30] + "..." if user.password_hash else None,
        "password_valid": password_valid,
        "normalized_email": normalized_email,
        "email_match": user.email == normalized_email
    }

