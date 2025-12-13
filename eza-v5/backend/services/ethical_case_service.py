# -*- coding: utf-8 -*-
"""
Ethical Case Service (PASİF DATASET)
Normalizes cases and telemetry events into trainable dataset format.

🔒 ALTIN KURAL:
- ❌ Eğitim pipeline'ı burayı kullanmayacak
- ❌ Hiçbir inference bu tabloyu okumayacak
- ✅ Sadece dataset olarak hazırlanacak
- ✅ Anonimleştirme otomatik
- ✅ is_trainable=false default
"""

import logging
import re
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.config import get_settings
from backend.models.ethical_case import EthicalCase

logger = logging.getLogger(__name__)


class EthicalCaseService:
    """
    Ethical Case Service (PASİF DATASET)
    
    Normalizes cases and telemetry events into trainable dataset format.
    Feature flag controlled - no-op if disabled.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.enabled = self.settings.LEARNING_PIPELINE_ENABLED
    
    def anonymize_text(self, text: str) -> str:
        """
        Anonymize text by removing PII.
        Simple implementation - can be enhanced later.
        """
        if not text:
            return ""
        
        # Remove email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
        
        # Remove phone numbers (Turkish format)
        text = re.sub(r'(\+90|0)?\s?[0-9]{3}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}', '[PHONE]', text)
        
        # Remove credit card numbers (simple pattern)
        text = re.sub(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', '[CARD]', text)
        
        # Remove Turkish ID numbers (11 digits)
        text = re.sub(r'\b\d{11}\b', '[ID]', text)
        
        return text
    
    async def create_ethical_case(
        self,
        db: AsyncSession,
        anonymized_text: str,
        risk_level: str,
        triggered_policies: Optional[List[str]] = None,
        original_case_id: Optional[UUID] = None,
        embedding_id: Optional[UUID] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        is_trainable: bool = False  # Default: false
    ) -> Optional[UUID]:
        """
        Create ethical case (PASİF DATASET).
        
        Returns:
            UUID of created case, or None if disabled/failed
        """
        if not self.enabled:
            # No-op if disabled - no log, no exception
            return None
        
        try:
            # Anonymize text if not already anonymized
            if anonymized_text and not anonymized_text.startswith('[ANONYMIZED]'):
                anonymized_text = self.anonymize_text(anonymized_text)
            
            # Create ethical case
            ethical_case = EthicalCase(
                original_case_id=original_case_id,
                anonymized_text=anonymized_text,
                risk_level=risk_level,
                triggered_policies=triggered_policies or [],
                embedding_id=embedding_id,
                is_trainable=is_trainable,  # Default: false
                source_type=source_type,
                source_id=source_id
            )
            
            db.add(ethical_case)
            await db.commit()
            await db.refresh(ethical_case)
            
            logger.debug(f"[EthicalCase] Created ethical case {ethical_case.id} (PASİF DATASET mode)")
            return ethical_case.id
            
        except Exception as e:
            logger.error(f"[EthicalCase] Failed to create ethical case: {e}")
            await db.rollback()
            return None  # Fail gracefully
    
    async def normalize_from_case(
        self,
        db: AsyncSession,
        case_id: UUID,
        case_text: str,
        risk_level: str,
        triggered_policies: Optional[List[str]] = None
    ) -> Optional[UUID]:
        """
        Normalize a Case into EthicalCase (PASİF DATASET).
        """
        if not self.enabled:
            return None
        
        return await self.create_ethical_case(
            db=db,
            anonymized_text=case_text,
            risk_level=risk_level,
            triggered_policies=triggered_policies,
            original_case_id=case_id,
            source_type="case",
            source_id=str(case_id),
            is_trainable=False  # Default: not trainable
        )
    
    async def normalize_from_telemetry(
        self,
        db: AsyncSession,
        telemetry_id: UUID,
        user_input: str,
        risk_level: Optional[str],
        policy_violations: Optional[List[str]] = None
    ) -> Optional[UUID]:
        """
        Normalize a TelemetryEvent into EthicalCase (PASİF DATASET).
        """
        if not self.enabled:
            return None
        
        return await self.create_ethical_case(
            db=db,
            anonymized_text=user_input,
            risk_level=risk_level or "low",
            triggered_policies=policy_violations or [],
            original_case_id=telemetry_id,
            source_type="telemetry_event",
            source_id=str(telemetry_id),
            is_trainable=False  # Default: not trainable
        )
    
    async def get_trainable_cases(
        self,
        db: AsyncSession,
        limit: int = 1000
    ) -> List[EthicalCase]:
        """
        Get trainable cases (READ-ONLY, for dataset export only).
        Returns empty list if LEARNING_PIPELINE_ENABLED=false.
        """
        if not self.enabled:
            return []
        
        try:
            result = await db.execute(
                select(EthicalCase)
                .where(EthicalCase.is_trainable == True)
                .limit(limit)
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"[EthicalCase] Failed to get trainable cases: {e}")
            return []
    
    async def get_statistics(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get ethical case statistics (READ-ONLY, for dashboard only).
        """
        if not self.enabled:
            return {
                "total_cases": 0,
                "trainable_cases": 0,
                "enabled": False
            }
        
        try:
            from sqlalchemy import func
            
            total_result = await db.execute(
                select(func.count(EthicalCase.id))
            )
            total = total_result.scalar() or 0
            
            trainable_result = await db.execute(
                select(func.count(EthicalCase.id))
                .where(EthicalCase.is_trainable == True)
            )
            trainable = trainable_result.scalar() or 0
            
            return {
                "total_cases": total,
                "trainable_cases": trainable,
                "enabled": True
            }
        except Exception as e:
            logger.error(f"[EthicalCase] Failed to get statistics: {e}")
            return {
                "total_cases": 0,
                "trainable_cases": 0,
                "enabled": False
            }

