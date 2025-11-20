# -*- coding: utf-8 -*-
"""
Authentication Router
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas.auth import LoginRequest, TokenResponse
from backend.services.auth_service import authenticate_user, create_token_response
from backend.utils.dependencies import get_db

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """User login endpoint"""
    user = await authenticate_user(db, request.email, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # TODO: Implement MFA verification if mfa_code is provided
    
    token_response = await create_token_response(user)
    return token_response

