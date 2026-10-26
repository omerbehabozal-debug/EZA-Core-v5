"""Brand asset validation. No database, upload, draft, or answer-engine calls."""
import importlib.util
import io
import uuid
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.core.utils.dependencies import startup_create_all_tables
from backend.models.business_yansi import BusinessYansiDraft
from backend.services.business_yansi.brand_assets import normalize_asset, public_media_allowed, validate_https_url


BUSINESS = uuid.UUID("11111111-1111-4111-8111-111111111111")
OTHER = uuid.UUID("22222222-2222-4222-8222-222222222222")
ITEM = uuid.UUID("33333333-3333-4333-8333-333333333333")
VERSION = uuid.UUID("44444444-4444-4444-8444-444444444444")
NEXT = uuid.UUID("55555555-5555-4555-8555-555555555555")
ASSET = uuid.UUID("66666666-6666-4666-8666-666666666666")
OWNER = uuid.UUID("77777777-7777-4777-8777-777777777777")


def _code(asset_type, **kwargs):
    with pytest.raises(HTTPException) as caught:
        normalize_asset(business_id=BUSINESS, asset_type=asset_type, title="BiligN", **kwargs)
    return caught.value.detail["code"]


def _row(**kwargs):
    return SimpleNamespace(**kwargs)


def _asset(**kwargs):
    values = dict(
        id=ASSET,
        business_id=BUSINESS,
        status="published",
        public_allowed=True,
        approved_by=OWNER,
    )
    values.update(kwargs)
    return _row(**values)


def _link(**kwargs):
    values = dict(
        asset_id=ASSET,
        business_id=BUSINESS,
        item_id=ITEM,
        confirmed_version_id=VERSION,
        status="active",
    )
    values.update(kwargs)
    return _row(**values)


def _knowledge(**kwargs):
    values = dict(
        id=VERSION,
        business_id=BUSINESS,
        item_id=ITEM,
        status="published",
        public_allowed=True,
        approved_by=OWNER,
    )
    values.update(kwargs)
    return _row(**values)


def _brand(identifier=BUSINESS):
    return _row(id=identifier, status="active")


def test_image_storage_and_remote_locators_are_typed():
    storage = (
        f"brand-assets/{BUSINESS}/"
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"
    )
    saved = normalize_asset(
        business_id=BUSINESS,
        asset_type="image",
        title="Atölye",
        locator_kind="storage",
        locator=storage,
    )
    assert saved["locator"] == storage and saved["latitude"] is None
    remote = normalize_asset(
        business_id=BUSINESS,
        asset_type="image",
        title="Atölye",
        locator_kind="https",
        locator="https://cdn.bilign.example/atelier.webp",
    )
    assert remote["locator_kind"] == "https"


def test_video_link_and_place_keep_their_fields():
    video = normalize_asset(
        business_id=BUSINESS,
        asset_type="video",
        title="Tur",
        locator_kind="https",
        locator="https://cdn.bilign.example/tour.mp4",
    )
    assert video["asset_type"] == "video" and video["latitude"] is None
    link = normalize_asset(
        business_id=BUSINESS,
        asset_type="link",
        title="Site",
        locator="https://bilign.example/hakkinda",
    )
    assert link["locator_kind"] == "https"
    place = normalize_asset(
        business_id=BUSINESS,
        asset_type="place",
        title="Atölye",
        latitude="41.0082",
        longitude="28.9784",
    )
    assert place["latitude"] == Decimal("41.008200")
    assert place["longitude"] == Decimal("28.978400")
    assert place["locator"] is None


@pytest.mark.parametrize(
    ("asset_type", "kwargs"),
    [
        ("image", {"locator_kind": "storage", "locator": "brand-assets/not-a-uuid/aa.png"}),
        ("image", {"locator_kind": "https", "locator": "http://cdn.bilign.example/a.png"}),
        ("image", {"locator_kind": "https", "locator": "javascript:alert(1)"}),
        ("image", {"locator_kind": "https", "locator": "https://user:pass@cdn.bilign.example/a.png"}),
        ("image", {"locator_kind": "https", "locator": "https://127.0.0.1/a.png"}),
        ("image", {"locator_kind": "https", "locator": "https://10.1.1.1/a.png"}),
        ("image", {"locator_kind": "https", "locator": "https://169.254.169.254/a.png"}),
        ("image", {"locator_kind": "https", "locator": "https://localhost/a.png"}),
        ("image", {"locator_kind": "https", "locator": "https://cdn.bilign.example/a.mp4"}),
        ("video", {"locator_kind": "storage", "locator": f"brand-assets/{BUSINESS}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"}),
        ("link", {"locator_kind": "storage", "locator": "brand-assets/x"}),
        ("place", {"locator": "https://maps.example/pin", "latitude": "41", "longitude": "29"}),
        ("place", {"latitude": "91", "longitude": "29"}),
        ("place", {"latitude": True, "longitude": "29"}),
        ("image", {"locator_kind": "https", "locator": "https://cdn.bilign.example/a.png", "latitude": "41", "longitude": "29"}),
    ],
)
def test_unsafe_or_mistyped_payloads_are_rejected(asset_type, kwargs):
    assert _code(asset_type, **kwargs) in {
        "asset_url_rejected",
        "asset_locator_rejected",
        "asset_coordinate_rejected",
    }


def test_storage_key_cannot_name_another_brand():
    foreign = (
        f"brand-assets/{OTHER}/"
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png"
    )
    assert _code("image", locator_kind="storage", locator=foreign) == "asset_locator_rejected"


def test_public_https_helper_rejects_private_and_link_local_hosts():
    assert validate_https_url("https://cdn.bilign.example/path") == "https://cdn.bilign.example/path"
    with pytest.raises(HTTPException):
        validate_https_url("https://[::1]/secret")


def test_unlinked_and_closed_assets_are_not_public():
    asset = _asset()
    knowledge = _knowledge()
    profile = _brand()
    organization = _brand()
    assert public_media_allowed(asset=asset, link=None, knowledge=knowledge, profile=profile, organization=organization) is False
    assert public_media_allowed(
        asset=_asset(public_allowed=False),
        link=_link(),
        knowledge=knowledge,
        profile=profile,
        organization=organization,
    ) is False
    assert public_media_allowed(
        asset=_asset(status="archived"),
        link=_link(),
        knowledge=knowledge,
        profile=profile,
        organization=organization,
    ) is False
    assert public_media_allowed(
        asset=asset,
        link=_link(status="retired"),
        knowledge=knowledge,
        profile=profile,
        organization=organization,
    ) is False
    assert public_media_allowed(
        asset=_asset(business_id=OTHER),
        link=_link(),
        knowledge=knowledge,
        profile=profile,
        organization=organization,
    ) is False


def test_a_new_knowledge_version_does_not_inherit_public_media():
    asset = _asset()
    profile = _brand()
    organization = _brand()
    current = public_media_allowed(
        asset=asset,
        link=_link(),
        knowledge=_knowledge(),
        profile=profile,
        organization=organization,
    )
    replacement = public_media_allowed(
        asset=asset,
        link=_link(),
        knowledge=_knowledge(id=NEXT),
        profile=profile,
        organization=organization,
    )
    archived = public_media_allowed(
        asset=asset,
        link=_link(),
        knowledge=_knowledge(status="archived"),
        profile=profile,
        organization=organization,
    )
    assert current is True
    assert replacement is False
    assert archived is False


def test_one_asset_can_be_confirmed_for_a_second_item_only():
    asset = _asset()
    second_item = uuid.uuid4()
    second_version = uuid.uuid4()
    visible = public_media_allowed(
        asset=asset,
        link=_link(item_id=second_item, confirmed_version_id=second_version),
        knowledge=_knowledge(id=second_version, item_id=second_item),
        profile=_brand(),
        organization=_brand(),
    )
    hidden = public_media_allowed(
        asset=asset,
        link=_link(item_id=second_item, confirmed_version_id=second_version),
        knowledge=_knowledge(),
        profile=_brand(),
        organization=_brand(),
    )
    assert visible is True and hidden is False


def test_existing_text_drafts_gain_no_media_column():
    assert "locator" not in BusinessYansiDraft.__table__.columns
    assert "steps" in BusinessYansiDraft.__table__.columns
    assert "knowledge_snapshot" in BusinessYansiDraft.__table__.columns


def test_startup_does_not_create_brand_asset_tables():
    names = {table.name for table in startup_create_all_tables()}
    assert "business_brand_assets" not in names
    assert "business_knowledge_asset_links" not in names
    assert "business_knowledge_versions" in names


def test_migration_follows_the_rag_head_and_leaves_text_yansi_tables():
    path = Path(__file__).parent.parent / "migrations/versions/add_business_brand_assets_v1.py"
    spec = importlib.util.spec_from_file_location("brand_assets_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "add_business_knowledge_chunks_fts_v1"
    upgrade_sql = io.StringIO()
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": upgrade_sql})
    with Operations.context(context):
        migration.upgrade()
    sql = upgrade_sql.getvalue()
    assert "business_brand_assets" in sql
    assert "business_knowledge_asset_links" in sql
    assert "fk_business_asset_link_version" in sql
    assert "ALTER TABLE business_yansi_drafts" not in sql
    assert "ALTER TABLE business_publications" not in sql
    assert "DROP TABLE" not in sql
    downgrade_sql = io.StringIO()
    down = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": downgrade_sql})
    with Operations.context(down):
        migration.downgrade()
    dropped = downgrade_sql.getvalue()
    assert "DROP TABLE business_knowledge_asset_links" in dropped
    assert "DROP TABLE business_brand_assets" in dropped
    assert "business_knowledge_versions" not in dropped
    assert "business_knowledge_chunks" not in dropped


def test_answer_and_draft_modules_do_not_import_brand_assets():
    root = Path(__file__).parent.parent
    for relative in (
        "services/business_yansi/answers.py",
        "services/business_yansi/business_rag_orchestrator.py",
        "services/business_yansi/publication.py",
        "services/business_yansi/studio_generation.py",
    ):
        text = (root / relative).read_text(encoding="utf-8")
        assert "brand_assets" not in text
        assert "business_brand_assets" not in text
