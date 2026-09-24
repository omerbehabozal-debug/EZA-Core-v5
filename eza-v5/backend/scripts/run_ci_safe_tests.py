# -*- coding: utf-8 -*-
"""CI entrypoint for the Backend CI-safe pytest suite.

Avoids a giant shell line-continuation block in GitHub Actions and keeps the
path list in ``ci_safe_pytest_paths.txt`` (one path per line).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_PATHS_FILE = Path(__file__).with_name("ci_safe_pytest_paths.txt")


def main(argv: list[str] | None = None) -> int:
    raw = _PATHS_FILE.read_text(encoding="utf-8").splitlines()
    paths = [line.strip() for line in raw if line.strip() and not line.strip().startswith("#")]
    if not paths:
        print(f"ERROR: no test paths in {_PATHS_FILE}", file=sys.stderr)
        return 4

    missing = [p for p in paths if not (_BACKEND_ROOT / p).exists()]
    if missing:
        print("ERROR: missing CI test paths:", file=sys.stderr)
        for path in missing:
            print(f"  - {path}", file=sys.stderr)
        return 4

    pytest_args = [
        *paths,
        "--tb=short",
        "--disable-warnings",
        *(argv or []),
    ]
    return int(pytest.main(pytest_args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
