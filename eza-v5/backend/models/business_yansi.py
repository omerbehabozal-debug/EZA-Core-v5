"""Business profiles extend existing Organization IDs; roles stay domain-specific."""
import json
import math
import struct
import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, UserDefinedType
from backend.core.utils.dependencies import Base

class Vector1536(UserDefinedType):
    """PostgreSQL pgvector column. SQLite tests store the same value as text."""
    cache_ok = True
    def get_col_spec(self, **kw):
        return "vector(1536)"

@compiles(Vector1536, "sqlite")
def _sqlite_vector(type_, compiler, **kw):
    return "TEXT"

_FLOAT32_MAX = 3.4028234663852886e38


def _finite_float32(number):
    """Value pgvector can store. None when float32 would be NaN, infinite, or out of range."""
    if math.isnan(number) or math.isinf(number) or abs(number) > _FLOAT32_MAX:
        return None
    try:
        stored = struct.unpack("<f", struct.pack("<f", float(number)))[0]
    except OverflowError:
        return None
    if math.isnan(stored) or math.isinf(stored):
        return None
    return stored


def canonical_embedding(value):
    """Text that will be stored. None when the stored vector would be invalid or all zeros."""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            if text.startswith("[") and text.endswith("]"):
                value = [item for item in text[1:-1].split(",") if item != ""]
            else:
                return None
    if not isinstance(value, (list, tuple)) or len(value) != 1536:
        return None
    rendered = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, (int, float, str)):
            return None
        try:
            number = float(item)
        except (TypeError, ValueError):
            return None
        stored = _finite_float32(number)
        if stored is None:
            return None
        rendered.append(format(stored, ".8f"))
    if all(part in {"0.00000000", "-0.00000000"} for part in rendered):
        return None
    return "[" + ",".join(rendered) + "]"

class EmbeddingVector(TypeDecorator):
    impl = Text
    cache_ok = True
    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector1536())
        return dialect.type_descriptor(Text())
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        rendered = canonical_embedding(value)
        if rendered is None:
            raise ValueError("embedding is not a finite 1536-d vector")
        return rendered
    def process_result_value(self, value, dialect):
        if value is None or value == "":
            return None
        if isinstance(value, list):
            return [float(item) for item in value]
        text = str(value).strip()
        if text.startswith("[") and text.endswith("]"):
            return [float(item) for item in text[1:-1].split(",") if item != ""]
        return json.loads(text)

class Timestamps:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class BusinessProfile(Timestamps, Base):
    __tablename__ = 'business_profiles'
    id = Column(UUID(as_uuid=True), ForeignKey('production_organizations.id'), primary_key=True)
    slug = Column(String(64), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    logo_url = Column(Text)
    description = Column(String(500), nullable=False, default='')
    owner_id = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)
    verified = Column(Boolean, nullable=False, default=False)
    official = Column(Boolean, nullable=False, default=False)
    status = Column(String(16), nullable=False, default='active')
    __table_args__ = (CheckConstraint("status IN ('active','suspended','archived')", name='ck_business_status'),)

class BusinessMember(Base):
    __tablename__ = 'business_members'
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), primary_key=True)
    role = Column(String(16), nullable=False)
    __table_args__ = (CheckConstraint("role IN ('owner','editor','viewer')", name='ck_business_role'),)

class BusinessKnowledgeVersion(Timestamps, Base):
    __tablename__ = 'business_knowledge_versions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(String(160), nullable=False)
    category = Column(String(80), nullable=False, default='')
    content = Column(Text, nullable=False)
    source = Column(String(1000), nullable=False)
    public_allowed = Column(Boolean, nullable=False, default=False)
    status = Column(String(16), nullable=False, default='draft')
    created_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'))
    revision = Column(Integer, nullable=False, default=1)
    __table_args__ = (
        UniqueConstraint('business_id','item_id','version', name='uq_business_knowledge_version'),
        UniqueConstraint('id','business_id','item_id', name='uq_business_knowledge_version_tenant'),
        CheckConstraint("status IN ('draft','review','approved','published','archived')", name='ck_business_knowledge_status'),
    )

class BusinessKnowledgeChunk(Timestamps, Base):
    """Derived retrieval rows. The knowledge version remains the source of truth."""
    __tablename__ = 'business_knowledge_chunks'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), nullable=False, index=True)
    knowledge_version_id = Column(UUID(as_uuid=True), ForeignKey('business_knowledge_versions.id'), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    embedding = Column(EmbeddingVector)
    embedding_model = Column(String(64))
    token_count = Column(Integer, nullable=False, default=0)
    index_status = Column(String(16), nullable=False, default='pending')
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(String(80))
    indexed_at = Column(DateTime(timezone=True))
    claim_token = Column(UUID(as_uuid=True))
    claim_owner = Column(String(64))
    lease_expires_at = Column(DateTime(timezone=True))
    next_attempt_at = Column(DateTime(timezone=True))
    __table_args__ = (
        UniqueConstraint('knowledge_version_id', 'chunk_index', name='uq_business_knowledge_chunk'),
        CheckConstraint(
            "index_status IN ('pending','leased','ready','failed','exhausted','retired')",
            name='ck_business_knowledge_chunk_status',
        ),
    )

class BusinessYansiDraft(Timestamps, Base):
    __tablename__ = 'business_yansi_drafts'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(String(500), nullable=False, default='')
    steps = Column(JSON, nullable=False)
    knowledge_snapshot = Column(JSON, nullable=False)
    source_hash = Column(String(64), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('standalone_conversations.id'))
    created_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'))
    status = Column(String(16), nullable=False, default='draft')
    revision = Column(Integer, nullable=False, default=1)
    __table_args__ = (CheckConstraint("status IN ('draft','review','approved','published','archived')", name='ck_business_draft_status'),)

class BusinessPublication(Timestamps, Base):
    __tablename__ = 'business_publications'
    slug = Column(String(64), ForeignKey('mirror_network_nodes.slug'), primary_key=True)
    journey_version = Column(Integer, primary_key=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), nullable=False, index=True)
    draft_id = Column(UUID(as_uuid=True), ForeignKey('business_yansi_drafts.id'), nullable=False)
    knowledge_snapshot = Column(JSON, nullable=False)
    published_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)

class BusinessBrandApplication(Timestamps, Base):
    """Applicant intake only — never grants Business membership by itself."""
    __tablename__ = 'business_brand_applications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    applicant_user_id = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False, index=True)
    brand_name = Column(String(120), nullable=False)
    brand_name_normalized = Column(String(120), nullable=False, index=True)
    contact_name = Column(String(120), nullable=False)
    corporate_email = Column(String(255), nullable=False)
    website = Column(String(500))
    company_info = Column(String(2000), nullable=False, default='')
    status = Column(String(16), nullable=False, default='received')
    reviewer_note = Column(String(1000), nullable=False, default='')
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey('production_users.id'))
    reviewed_at = Column(DateTime(timezone=True))
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'))
    __table_args__ = (CheckConstraint("status IN ('received','under_review','approved','rejected')", name='ck_business_application_status'),)

class BusinessApplicationEvent(Base):
    """Append-only audit for application and resulting authority changes."""
    __tablename__ = 'business_application_events'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey('business_brand_applications.id'), nullable=False, index=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)
    action = Column(String(40), nullable=False)
    from_status = Column(String(16))
    to_status = Column(String(16))
    detail = Column(JSON, nullable=False, default=lambda: {})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
