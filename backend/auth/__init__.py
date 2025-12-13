# -*- coding: utf-8 -*-
"""
Authentication Module
JWT-based authentication and authorization
"""

from backend.auth.jwt import create_jwt, decode_jwt
from backend.auth.models import UserRole
from backend.auth.deps import require_role, get_current_user
from backend.auth.api_key import validate_api_key, require_api_key

__all__ = [
    "create_jwt",
    "decode_jwt",
    "UserRole",
    "require_role",
    "get_current_user",
    "validate_api_key",
    "require_api_key"
]

