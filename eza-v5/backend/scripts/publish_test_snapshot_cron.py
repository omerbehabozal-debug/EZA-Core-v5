#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Publish Test Snapshot Cron Job
Runs daily/weekly/monthly to publish test result snapshots.
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.services.publish_test_snapshot import publish_snapshot
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Publish test snapshot for daily period"""
    try:
        snapshot = publish_snapshot(period="daily")
        logger.info(f"✅ Daily snapshot published: {snapshot.snapshot_id}")
        logger.info(f"   Period: {snapshot.period}")
        logger.info(f"   Generated at: {snapshot.generated_at}")
        logger.info(f"   Test Suites: {len(snapshot.test_suites)}")
        logger.info(f"   Latest Runs: {len(snapshot.latest_runs)}")
        return 0
    except Exception as e:
        logger.error(f"❌ Failed to publish snapshot: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

