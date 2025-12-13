#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test JWT Token Generator
Quick script to generate test JWT tokens for development
"""

import sys
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from backend.auth.jwt import create_jwt

def main():
    """Generate test tokens for different roles"""
    
    print("=" * 60)
    print("EZA-Core V6 - Test JWT Token Generator")
    print("=" * 60)
    print()
    
    # Generate tokens for different roles
    roles = ["admin", "corporate", "regulator"]
    
    for role_name in roles:
        token = create_jwt(
            user_id=1,
            role=role_name,
            expires_in_hours=24  # 24 saat geçerli
        )
        
        print(f"Role: {role_name.upper()}")
        print(f"Token: {token}")
        print()
        print("-" * 60)
        print()
    
    print("Kullanım:")
    print("1. Login sayfasına gidin: http://localhost:3001/login")
    print("2. Yukarıdaki token'lardan birini kopyalayın")
    print("3. İlgili role'ü seçin (admin, corporate, regulator)")
    print("4. Login butonuna tıklayın")
    print()

if __name__ == "__main__":
    main()

