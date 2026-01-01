# -*- coding: utf-8 -*-
"""
Publish Test Snapshot Service
Snapshot-based publishing model for public test results.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid

from backend.models.published_test_snapshot import PublishedTestSnapshot
from backend.services.comprehensive_test_results import get_comprehensive_test_results

# In-memory storage for published snapshots
# TODO: Can be migrated to database or Redis for persistence
PUBLISHED_SNAPSHOTS: dict[str, PublishedTestSnapshot] = {}


def publish_snapshot(period: str = "daily") -> PublishedTestSnapshot:
    """
    Publish a snapshot of current test results.
    
    This function:
    - Gets current comprehensive test results
    - Creates a snapshot with unique ID
    - Stores it in memory (or future: database/Redis)
    - Returns the published snapshot
    
    Args:
        period: Snapshot period ("daily", "weekly", "monthly")
    
    Returns:
        PublishedTestSnapshot: The published snapshot
    """
    # Get current comprehensive test results
    results = get_comprehensive_test_results()
    
    # Convert Pydantic model to dict for storage
    results_dict = results.model_dump()
    
    # Create snapshot
    snapshot = PublishedTestSnapshot(
        snapshot_id=str(uuid.uuid4()),
        period=period,
        generated_at=datetime.now(timezone.utc),
        overall=results_dict["overall"],
        test_suites=results_dict["test_suites"],
        latest_runs=results_dict["latest_runs"],
        improvements=results_dict["improvements"]
    )
    
    # Store snapshot (in-memory for now)
    PUBLISHED_SNAPSHOTS[period] = snapshot
    
    return snapshot


def get_latest_snapshot(period: str = "daily") -> Optional[PublishedTestSnapshot]:
    """
    Get the latest published snapshot for a given period.
    
    Args:
        period: Snapshot period ("daily", "weekly", "monthly")
    
    Returns:
        PublishedTestSnapshot | None: The latest snapshot or None if not found
    """
    return PUBLISHED_SNAPSHOTS.get(period)


def get_all_snapshots() -> dict[str, PublishedTestSnapshot]:
    """
    Get all published snapshots.
    
    Returns:
        dict: Dictionary of period -> snapshot
    """
    return PUBLISHED_SNAPSHOTS.copy()

