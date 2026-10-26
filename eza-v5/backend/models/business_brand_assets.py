"""Brand-owned media, places, and links. Knowledge associations are optional.

An asset belongs to one business. A link confirms that asset against one
knowledge item and one knowledge version. A later knowledge version does not
inherit that confirmation. Unlinked assets remain stored and are not public.
"""
import uuid

from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, Numeric, UniqueConstraint, CheckConstraint, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class BusinessBrandAsset(Base):
    __tablename__ = "business_brand_assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False, index=True)
    asset_type = Column(String(16), nullable=False)
    title = Column(String(160), nullable=False)
    caption = Column(String(500))
    locator_kind = Column(String(16))
    locator = Column(String(1000))
    latitude = Column(Numeric(8, 6))
    longitude = Column(Numeric(9, 6))
    public_allowed = Column(Boolean, nullable=False, default=False)
    status = Column(String(16), nullable=False, default="draft")
    created_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"))
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("id", "business_id", name="uq_business_brand_asset_tenant"),
        CheckConstraint("asset_type IN ('image','video','place','link')", name="ck_business_brand_asset_type"),
        CheckConstraint("status IN ('draft','review','approved','published','archived')", name="ck_business_brand_asset_status"),
        CheckConstraint(
            "("
            "asset_type = 'place' AND latitude IS NOT NULL AND longitude IS NOT NULL "
            "AND latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180 "
            "AND locator IS NULL AND locator_kind IS NULL"
            ") OR ("
            "asset_type = 'link' AND locator IS NOT NULL AND locator_kind = 'https' "
            "AND latitude IS NULL AND longitude IS NULL"
            ") OR ("
            "asset_type IN ('image','video') AND locator IS NOT NULL "
            "AND locator_kind IN ('https','storage') AND latitude IS NULL AND longitude IS NULL"
            ")",
            name="ck_business_brand_asset_payload",
        ),
    )


class BusinessKnowledgeAssetLink(Base):
    """Confirms one asset for one knowledge item at one version. Not required to store the asset."""

    __tablename__ = "business_knowledge_asset_links"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False, index=True)
    asset_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    confirmed_version_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String(16), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("asset_id", "item_id", name="uq_business_knowledge_asset_item"),
        CheckConstraint("status IN ('active','retired')", name="ck_business_knowledge_asset_link_status"),
        ForeignKeyConstraint(
            ["asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_asset_link_asset",
        ),
        ForeignKeyConstraint(
            ["confirmed_version_id", "business_id", "item_id"],
            ["business_knowledge_versions.id", "business_knowledge_versions.business_id", "business_knowledge_versions.item_id"],
            name="fk_business_asset_link_version",
        ),
    )
