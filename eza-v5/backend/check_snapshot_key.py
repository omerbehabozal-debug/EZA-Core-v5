#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Check PUBLIC_SNAPSHOT_KEY Configuration
Quick script to verify the key is set correctly.
"""

import sys
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent
parent_dir = backend_dir.parent
sys.path.insert(0, str(parent_dir))

from backend.config import get_settings

def main():
    settings = get_settings()
    key = settings.PUBLIC_SNAPSHOT_KEY
    
    print("=" * 60)
    print("PUBLIC_SNAPSHOT_KEY Configuration Check")
    print("=" * 60)
    print()
    
    if not key:
        print("❌ PUBLIC_SNAPSHOT_KEY is NOT set")
        print()
        print("To set it:")
        print("1. Add to .env file: PUBLIC_SNAPSHOT_KEY=your-key-here")
        print("2. Or set environment variable: $env:PUBLIC_SNAPSHOT_KEY='your-key-here'")
        return 1
    
    print("✅ PUBLIC_SNAPSHOT_KEY is set")
    print(f"   Length: {len(key)} characters")
    print(f"   First 4 chars: {key[:4]}...")
    print(f"   Last 4 chars: ...{key[-4:]}")
    print()
    print("Key preview (first 10 chars):", key[:10] + "...")
    print()
    print("✅ Configuration looks good!")
    return 0

if __name__ == "__main__":
    sys.exit(main())

