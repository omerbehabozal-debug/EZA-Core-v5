#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Publish Test Snapshot Cron Job
Runs daily/weekly/monthly to publish test result snapshots.
Uses HTTP API with publish key for security.
"""

import sys
import os
import requests
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Publish test snapshot for daily period via HTTP API"""
    # Get publish key from environment
    publish_key = os.getenv("PUBLIC_SNAPSHOT_KEY")
    api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    if not publish_key:
        logger.error("❌ PUBLIC_SNAPSHOT_KEY environment variable not set")
        return 1
    
    try:
        # Call publish endpoint with key
        url = f"{api_base_url}/api/public/publish?period=daily"
        headers = {
            "x-eza-publish-key": publish_key
        }
        
        response = requests.post(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Daily snapshot published: {data.get('snapshot_id')}")
            logger.info(f"   Period: {data.get('period')}")
            logger.info(f"   Generated at: {data.get('generated_at')}")
            logger.info(f"   Test Suites: {data.get('test_suites_count')}")
            logger.info(f"   Latest Runs: {data.get('latest_runs_count')}")
            return 0
        else:
            logger.error(f"❌ Failed to publish snapshot: HTTP {response.status_code}")
            logger.error(f"   Response: {response.text}")
            return 1
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Request failed: {e}")
        return 1
    except Exception as e:
        logger.error(f"❌ Failed to publish snapshot: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

