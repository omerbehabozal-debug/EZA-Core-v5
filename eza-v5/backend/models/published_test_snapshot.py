# -*- coding: utf-8 -*-
"""
Published Test Snapshot Model
Snapshot-based publishing model for public test results.
"""

from datetime import datetime
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class PublishedTestSnapshot(BaseModel):
    """Published test snapshot for public consumption"""
    snapshot_id: str
    period: str = Field(pattern="^(daily|weekly|monthly)$")  # "daily" | "weekly" | "monthly"
    generated_at: datetime
    
    overall: Dict[str, Any]
    test_suites: List[Dict[str, Any]]
    latest_runs: List[Dict[str, Any]]
    improvements: Dict[str, Any]
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

