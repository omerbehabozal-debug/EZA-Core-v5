# -*- coding: utf-8 -*-
"""
Ethical Embedding Model (PASİF)
Stores ethical embeddings for future training, but NEVER used in decision making.

🔒 ALTIN KURAL: Bu embedding hiçbir skoru etkilemeyecek.
Policy Engine embedding okumayacak. Sadece saklanacak.
"""

from sqlalchemy import Column, String, Float, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
import uuid
from backend.core.utils.dependencies import Base


class EthicalEmbedding(Base):
    """
    Ethical Embedding Model (PASİF)
    
    Stores embeddings of analyzed content for future training.
    Feature flag: ETHICAL_EMBEDDING_ENABLED (default: false)
    
    ❌ This embedding NEVER affects scores
    ❌ Policy Engine NEVER reads this
    ✅ Only stored for future use
    """
    __tablename__ = "ethical_embeddings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    case_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # FK to cases.id (optional)
    
    # Embedding vector (stored as array of floats)
    embedding_vector = Column(ARRAY(Float), nullable=False)
    
    # Policy scores (for reference, NOT used in decisions)
    n_score = Column(Float, nullable=True)  # Negative content score
    f_score = Column(Float, nullable=True)  # Freedom score
    z_score = Column(Float, nullable=True)  # Harm prevention score
    a_score = Column(Float, nullable=True)  # Discrimination score
    
    # Provider and model info
    provider = Column(String(100), nullable=True)  # openai, groq, mistral
    model_version = Column(String(100), nullable=True)  # gpt-4o-mini, etc.
    
    # Metadata
    original_text_hash = Column(String(64), nullable=True, index=True)  # SHA256 hash for deduplication
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Indexes for common queries (read-only analytics)
    __table_args__ = (
        Index('idx_ethical_embedding_case_id', 'case_id'),
        Index('idx_ethical_embedding_created', 'created_at'),
        Index('idx_ethical_embedding_provider', 'provider'),
    )

