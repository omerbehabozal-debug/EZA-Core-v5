# -*- coding: utf-8 -*-
"""
Policy Telemetry Service (READ-ONLY)
Tracks policy performance metrics, but NEVER automatically updates policies.

🔒 ALTIN KURAL:
- ❌ Policy ağırlıkları otomatik güncellenmeyecek
- ❌ Threshold'lar otomatik değişmeyecek
- ✅ Sadece dashboard ve raporlamada kullanılacak
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from backend.config import get_settings
from backend.models.policy_telemetry import PolicyTelemetry

logger = logging.getLogger(__name__)


class PolicyTelemetryService:
    """
    Policy Telemetry Service (READ-ONLY)
    
    Tracks policy performance for analytics.
    Feature flag controlled - no-op if disabled.
    """
    
    def __init__(self):
        self.settings = get_settings()
        # Policy telemetry is always enabled (read-only, no risk)
        # But we can add a flag if needed: self.enabled = self.settings.POLICY_TELEMETRY_ENABLED
    
    async def record_policy_trigger(
        self,
        db: AsyncSession,
        policy_id: str,
        was_correct: Optional[bool] = None  # True=correct, False=false_positive, None=unknown
    ) -> bool:
        """
        Record policy trigger (READ-ONLY tracking).
        
        Args:
            policy_id: Policy identifier (e.g., "N1", "F2")
            was_correct: True if correct trigger, False if false positive, None if unknown
        """
        try:
            # Get or create telemetry record
            result = await db.execute(
                select(PolicyTelemetry).where(PolicyTelemetry.policy_id == policy_id)
            )
            telemetry = result.scalar_one_or_none()
            
            if not telemetry:
                # Create new record
                telemetry = PolicyTelemetry(
                    policy_id=policy_id,
                    times_triggered=1,
                    false_positive=1 if was_correct is False else 0,
                    false_negative=0
                )
                db.add(telemetry)
            else:
                # Update existing record
                telemetry.times_triggered += 1
                if was_correct is False:
                    telemetry.false_positive += 1
            
            await db.commit()
            return True
            
        except Exception as e:
            logger.error(f"[PolicyTelemetry] Failed to record trigger: {e}")
            await db.rollback()
            return False  # Fail gracefully
    
    async def record_false_negative(
        self,
        db: AsyncSession,
        policy_id: str
    ) -> bool:
        """
        Record false negative (policy should have triggered but didn't).
        READ-ONLY tracking only.
        """
        try:
            result = await db.execute(
                select(PolicyTelemetry).where(PolicyTelemetry.policy_id == policy_id)
            )
            telemetry = result.scalar_one_or_none()
            
            if not telemetry:
                telemetry = PolicyTelemetry(
                    policy_id=policy_id,
                    times_triggered=0,
                    false_positive=0,
                    false_negative=1
                )
                db.add(telemetry)
            else:
                telemetry.false_negative += 1
            
            await db.commit()
            return True
            
        except Exception as e:
            logger.error(f"[PolicyTelemetry] Failed to record false negative: {e}")
            await db.rollback()
            return False
    
    async def calculate_suggested_threshold(
        self,
        db: AsyncSession,
        policy_id: str
    ) -> Optional[float]:
        """
        Calculate suggested threshold (READ-ONLY - for human review only).
        
        Returns:
            Suggested threshold value, or None if insufficient data
        """
        try:
            result = await db.execute(
                select(PolicyTelemetry).where(PolicyTelemetry.policy_id == policy_id)
            )
            telemetry = result.scalar_one_or_none()
            
            if not telemetry or telemetry.times_triggered < 10:
                # Insufficient data
                return None
            
            # Simple calculation: reduce threshold if too many false positives
            # This is READ-ONLY - never auto-applied
            false_positive_rate = telemetry.false_positive / telemetry.times_triggered if telemetry.times_triggered > 0 else 0
            
            # Store suggestion (not auto-applied)
            if false_positive_rate > 0.2:  # More than 20% false positives
                # Suggest increasing threshold (making it stricter)
                suggested = 0.7  # Placeholder - actual calculation would be more sophisticated
                telemetry.suggested_threshold = suggested
                telemetry.confidence_score = min(false_positive_rate, 0.9)
                await db.commit()
                return suggested
            
            return None
            
        except Exception as e:
            logger.error(f"[PolicyTelemetry] Failed to calculate suggested threshold: {e}")
            return None
    
    async def get_policy_metrics(
        self,
        db: AsyncSession,
        policy_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get policy metrics (READ-ONLY, for dashboard only).
        """
        try:
            query = select(PolicyTelemetry)
            if policy_id:
                query = query.where(PolicyTelemetry.policy_id == policy_id)
            
            result = await db.execute(query)
            telemetries = result.scalars().all()
            
            return [
                {
                    "policy_id": t.policy_id,
                    "times_triggered": t.times_triggered,
                    "false_positive": t.false_positive,
                    "false_negative": t.false_negative,
                    "false_positive_rate": t.false_positive / t.times_triggered if t.times_triggered > 0 else 0,
                    "suggested_threshold": t.suggested_threshold,
                    "confidence_score": t.confidence_score,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None
                }
                for t in telemetries
            ]
        except Exception as e:
            logger.error(f"[PolicyTelemetry] Failed to get metrics: {e}")
            return []
    
    async def get_statistics(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get overall policy telemetry statistics (READ-ONLY).
        """
        try:
            from sqlalchemy import func
            
            result = await db.execute(
                select(
                    func.count(PolicyTelemetry.id),
                    func.sum(PolicyTelemetry.times_triggered),
                    func.sum(PolicyTelemetry.false_positive),
                    func.sum(PolicyTelemetry.false_negative)
                )
            )
            row = result.first()
            
            total_policies = row[0] or 0
            total_triggered = row[1] or 0
            total_false_positive = row[2] or 0
            total_false_negative = row[3] or 0
            
            return {
                "total_policies_tracked": total_policies,
                "total_triggers": total_triggered,
                "total_false_positives": total_false_positive,
                "total_false_negatives": total_false_negative,
                "overall_false_positive_rate": total_false_positive / total_triggered if total_triggered > 0 else 0
            }
        except Exception as e:
            logger.error(f"[PolicyTelemetry] Failed to get statistics: {e}")
            return {
                "total_policies_tracked": 0,
                "total_triggers": 0,
                "total_false_positives": 0,
                "total_false_negatives": 0,
                "overall_false_positive_rate": 0
            }

