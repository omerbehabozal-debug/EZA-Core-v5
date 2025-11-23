# -*- coding: utf-8 -*-
"""
Run script for EZA v5 Backend
Use this to run the server from backend directory
"""

import sys
from pathlib import Path

# Add parent directory to Python path
backend_dir = Path(__file__).parent
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

