#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generate Public Snapshot Key
Generates a secure random key for PUBLIC_SNAPSHOT_KEY environment variable.
"""

import secrets
import string

def generate_snapshot_key(length: int = 32) -> str:
    """
    Generate a secure random key for PUBLIC_SNAPSHOT_KEY.
    
    Args:
        length: Key length (default: 32 characters)
    
    Returns:
        str: Secure random key
    """
    # Use URL-safe base64 characters
    alphabet = string.ascii_letters + string.digits + "-_"
    key = ''.join(secrets.choice(alphabet) for _ in range(length))
    return key

if __name__ == "__main__":
    key = generate_snapshot_key(32)
    print("=" * 60)
    print("PUBLIC_SNAPSHOT_KEY")
    print("=" * 60)
    print(key)
    print()
    print("Bu key'i environment variable olarak ayarlayın:")
    print(f"export PUBLIC_SNAPSHOT_KEY=\"{key}\"")
    print()
    print("Veya .env dosyasına ekleyin:")
    print(f"PUBLIC_SNAPSHOT_KEY={key}")
    print()

