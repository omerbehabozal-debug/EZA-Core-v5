# -*- coding: utf-8 -*-
"""
Ethical Embedding Service (PASİF)
Stores ethical embeddings for future training, but NEVER used in decision making.

🔒 ALTIN KURAL:
- ❌ Bu embedding hiçbir skoru etkilemeyecek
- ❌ Policy Engine embedding okumayacak
- ✅ Sadece saklanacak
- ✅ Feature flag: ETHICAL_EMBEDDING_ENABLED=false (default)
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.config import get_settings
from backend.models.ethical_embedding import EthicalEmbedding

logger = logging.getLogger(__name__)


class EthicalEmbeddingService:
    """
    Ethical Embedding Service (PASİF)
    
    Stores embeddings of analyzed content for future training.
    Feature flag controlled - no-op if disabled.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.enabled = self.settings.ETHICAL_EMBEDDING_ENABLED
    
    async def store_embedding(
        self,
        db: AsyncSession,
        embedding_vector: List[float],
        n_score: Optional[float] = None,
        f_score: Optional[float] = None,
        z_score: Optional[float] = None,
        a_score: Optional[float] = None,
        provider: Optional[str] = None,
        model_version: Optional[str] = None,
        original_text: Optional[str] = None,
        case_id: Optional[UUID] = None
    ) -> Optional[UUID]:
        """
        Store ethical embedding (PASİF).
        
        Returns:
            UUID of stored embedding, or None if disabled/failed
        """
        if not self.enabled:
            # No-op if disabled - no log, no exception
            return None
        
        try:
            # Calculate text hash for deduplication
            text_hash = None
            if original_text:
                text_hash = hashlib.sha256(original_text.encode('utf-8')).hexdigest()
            
            # Check for duplicate (optional - can be disabled for performance)
            if text_hash:
                existing = await db.execute(
                    select(EthicalEmbedding).where(
                        EthicalEmbedding.original_text_hash == text_hash
                    )
                )
                if existing.scalar_one_or_none():
                    logger.debug(f"[EthicalEmbedding] Duplicate detected (hash: {text_hash[:8]}...), skipping")
                    return None
            
            # Create embedding record
            embedding = EthicalEmbedding(
                case_id=case_id,
                embedding_vector=embedding_vector,
                n_score=n_score,
                f_score=f_score,
                z_score=z_score,
                a_score=a_score,
                provider=provider,
                model_version=model_version,
                original_text_hash=text_hash
            )
            
            db.add(embedding)
            await db.commit()
            await db.refresh(embedding)
            
            logger.debug(f"[EthicalEmbedding] Stored embedding {embedding.id} (PASİF mode)")
            return embedding.id
            
        except Exception as e:
            logger.error(f"[EthicalEmbedding] Failed to store embedding: {e}")
            await db.rollback()
            return None  # Fail gracefully - don't affect main pipeline
    
    async def get_embedding(
        self,
        db: AsyncSession,
        embedding_id: UUID
    ) -> Optional[EthicalEmbedding]:
        """
        Get embedding by ID (READ-ONLY, for analytics only).
        """
        if not self.enabled:
            return None
        
        try:
            result = await db.execute(
                select(EthicalEmbedding).where(EthicalEmbedding.id == embedding_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"[EthicalEmbedding] Failed to get embedding: {e}")
            return None
    
    async def get_embeddings_by_case(
        self,
        db: AsyncSession,
        case_id: UUID,
        limit: int = 100
    ) -> List[EthicalEmbedding]:
        """
        Get embeddings by case ID (READ-ONLY, for analytics only).
        """
        if not self.enabled:
            return []
        
        try:
            result = await db.execute(
                select(EthicalEmbedding)
                .where(EthicalEmbedding.case_id == case_id)
                .limit(limit)
            )
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"[EthicalEmbedding] Failed to get embeddings by case: {e}")
            return []
    
    async def get_statistics(
        self,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Get embedding statistics (READ-ONLY, for dashboard only).
        """
        if not self.enabled:
            return {
                "total_embeddings": 0,
                "enabled": False
            }
        
        try:
            from sqlalchemy import func
            
            result = await db.execute(
                select(func.count(EthicalEmbedding.id))
            )
            total = result.scalar() or 0
            
            return {
                "total_embeddings": total,
                "enabled": True
            }
        except Exception as e:
            logger.error(f"[EthicalEmbedding] Failed to get statistics: {e}")
            return {
                "total_embeddings": 0,
                "enabled": False
            }

