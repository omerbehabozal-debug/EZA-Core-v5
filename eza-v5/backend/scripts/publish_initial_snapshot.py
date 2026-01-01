#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Publish Initial Test Snapshot
Manually publishes the first snapshot for public access.
Run this script to create the initial snapshot.
"""

import sys
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.services.publish_test_snapshot import publish_snapshot
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Publish initial snapshot for daily period"""
    try:
        logger.info("Publishing initial snapshot...")
        snapshot = publish_snapshot(period="daily")
        
        logger.info("✅ Snapshot published successfully!")
        logger.info(f"   Snapshot ID: {snapshot.snapshot_id}")
        logger.info(f"   Period: {snapshot.period}")
        logger.info(f"   Generated at: {snapshot.generated_at}")
        logger.info(f"   Test Suites: {len(snapshot.test_suites)}")
        logger.info(f"   Latest Runs: {len(snapshot.latest_runs)}")
        logger.info("")
        logger.info("Now you can access the snapshot at:")
        logger.info("   GET /api/public/test-safety-benchmarks?period=daily")
        
        return 0
    except Exception as e:
        logger.error(f"❌ Failed to publish snapshot: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

