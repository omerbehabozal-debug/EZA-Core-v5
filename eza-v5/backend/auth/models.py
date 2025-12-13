# -*- coding: utf-8 -*-
"""
Authentication Models
Role definitions and user models
"""

from typing import Literal

# User roles
UserRole = Literal["admin", "corporate", "regulator"]

# Role hierarchy (for permission checks)
ROLE_HIERARCHY = {
    "admin": 3,  # Highest
    "corporate": 2,
    "regulator": 2,
    "public": 0  # No auth
}

