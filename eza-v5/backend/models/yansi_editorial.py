"""Derived public presentation; frozen rows are never updated."""
import uuid
from sqlalchemy import Column, String, Integer, JSON, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from backend.core.utils.dependencies import Base


class YansiEditorialVersion(Base):
    __tablename__ = "yansi_editorial_versions"
    __table_args__ = (
        UniqueConstraint("slug", "journey_version", "language", "template_version", "source_hash", name="uq_yansi_editorial_identity"),
        CheckConstraint("status IN ('pending','processing','ready','failed')", name="ck_yansi_editorial_status"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(64), ForeignKey("mirror_network_nodes.slug", ondelete="CASCADE"), nullable=False)
    journey_version = Column(Integer, nullable=False)
    language = Column(String(16), nullable=False)
    template_version = Column(Integer, nullable=False)
    source_hash = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False)
    structure = Column(JSON, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    retry_after = Column(DateTime(timezone=True), nullable=True)
