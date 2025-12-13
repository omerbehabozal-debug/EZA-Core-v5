#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test Runner Entry Point
This script can be run from any directory and will find the backend module.
"""

import sys
import os
from pathlib import Path

# Find the eza-v5 directory (parent of backend)
_script_file = Path(__file__).resolve()
_backend_dir = _script_file.parent
_eza_v5_dir = _backend_dir.parent

# Add eza-v5 to Python path
if str(_eza_v5_dir) not in sys.path:
    sys.path.insert(0, str(_eza_v5_dir))

# Change to eza-v5 directory
os.chdir(_eza_v5_dir)

# Now import and run the test runner
from backend.services.test_runner_service import main

if __name__ == "__main__":
    main()

