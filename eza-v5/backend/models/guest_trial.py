"""Private guest trial, owned exclusively by the existing token fingerprint."""
from sqlalchemy import Column, DateTime, JSON, String
from backend.core.utils.dependencies import Base

class GuestTrial(Base):
    __tablename__ = "guest_trials"
    guest_fingerprint = Column(String(32), primary_key=True)
    session_id = Column(String(36), nullable=False, unique=True)
    source_slug = Column(String(64), nullable=False)
    session_payload = Column(JSON, nullable=False)
    turns = Column(JSON, nullable=False, default=list)
    started_at = Column(DateTime(timezone=True), nullable=True)
