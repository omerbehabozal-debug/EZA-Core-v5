"""Automatic Yansı media stays on confirmed, current, public brand assets."""
import importlib.util
import io
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock

from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_yansi import sample, source


_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24


def _steps(knowledge, question="Seramik nedir bu adimda?"):
    return [
        {"question": f"{question} {index}", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for index in range(8)
    ]


async def _asset(sample, knowledge, **fields):
    image_bytes = fields.pop("image_bytes", None)
    row = await library.create_asset(sample.db, sample.business.id, sample.editor.id, fields, image_bytes=image_bytes)
    linked = await library.set_links(sample.db, sample.business.id, sample.editor.id, row.id, [knowledge.id], row.revision)
    return linked


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_studio_selects_contextual_media_and_cover(sample, asset_dir):
    knowledge = await source(sample, title="Seramik", content="Seramik kaplama su gecirmez ve atolyede uretilir.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik atolyesi", caption="Kapak", public_allowed=True, image_bytes=_PNG)
    link = await _asset(sample, knowledge, asset_type="link", title="Seramik sitesi", caption="", locator="https://bilign.example/seramik", public_allowed=True)
    await _asset(sample, knowledge, asset_type="video", title="Garanti filmi", caption="", locator="https://cdn.bilign.example/garanti.mp4", public_allowed=True)
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik Yansisi", "Seramik ozeti", _steps(knowledge))
    chosen = {block["assetId"] for block in draft.media_plan["blocks"][0]}
    assert chosen == {str(image.id), str(link.id)}
    assert {block["type"] for block in draft.media_plan["blocks"][0]} == {"image", "link"}
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert all(set(step) == {"question", "answer", "sources"} for step in draft.steps)
    assert "https://" not in str(draft.steps)
    assert draft.source_hash == svc.source_hash(draft.steps)


@pytest.mark.asyncio
async def test_other_brand_unlinked_private_and_old_version_are_not_chosen(sample, asset_dir):
    knowledge = await source(sample, title="Seramik", content="Seramik kaplama su gecirmez.")
    await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "link", "title": "Seramik notu", "locator": "https://bilign.example/not", "public_allowed": True,
    })
    await _asset(sample, knowledge, asset_type="link", title="Seramik gizli", locator="https://bilign.example/gizli", public_allowed=False)
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "akdeniz", "name": "Akdeniz",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "link", "title": "Seramik disari", "locator": "https://akdeniz.example/seramik", "public_allowed": True,
    })
    plain = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik", "Seramik", _steps(knowledge))
    assert plain.media_plan["blocks"] == [[] for _ in range(8)]
    assert plain.media_plan["coverAssetId"] is None
    with pytest.raises(HTTPException) as rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Seramik", "Seramik", _steps(knowledge),
            media_choices=[[{"type": "link", "assetId": str(foreign.id)}]] + [[] for _ in range(7)],
        )
    assert rejected.value.detail["code"] == "asset_choice_rejected"
    linked = await _asset(sample, knowledge, asset_type="link", title="Seramik eski", locator="https://bilign.example/eski", public_allowed=True)
    current = await svc.create_knowledge(sample.db, sample.business.id, sample.editor.id, {
        "itemId": str(knowledge.item_id), "title": "Seramik", "content": "Seramik kaplama yenilendi.",
        "source": "Guncel duyuru", "publicAllowed": True,
    })
    refreshed = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik", "Seramik", _steps(current))
    assert str(linked.id) not in str(refreshed.media_plan["blocks"])


@pytest.mark.asyncio
async def test_model_urls_coordinates_and_paths_are_rejected(sample, asset_dir):
    knowledge = await source(sample, content="Seramik kaplama su gecirmez.")
    steps = _steps(knowledge)
    for choice in (
        [{"type": "image", "url": "https://evil.example/a.png"}],
        [{"type": "map", "latitude": "41.0", "longitude": "29.0"}],
        [{"type": "video", "path": "brand-assets/not-a-real-key.mp4"}],
    ):
        with pytest.raises(HTTPException) as rejected:
            await svc.create_draft(
                sample.db, sample.business.id, sample.editor.id, "Seramik", "Seramik", steps,
                media_choices=[choice] + [[] for _ in range(7)],
            )
        assert rejected.value.detail["code"] == "asset_choice_rejected"
    with pytest.raises(HTTPException) as embedded:
        await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik", "Seramik", [
            {**steps[0], "blocks": [{"type": "link", "url": "https://evil.example"}]}, *steps[1:]
        ])
    assert embedded.value.detail["code"] == "asset_choice_rejected"


@pytest.mark.asyncio
async def test_text_yansi_without_media_keeps_question_and_answer(sample, asset_dir):
    knowledge = await source(sample, content="Yalnizca metin kaydi yeterince aciktir.")
    steps = [{"question": f"Yalnizca metin {index}?", "answer": knowledge.content, "sources": [str(knowledge.id)]} for index in range(8)]
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Metin", "Metin", steps)
    assert draft.steps == steps
    assert draft.media_plan["coverAssetId"] is None
    assert draft.media_plan["blocks"] == [[] for _ in range(8)]
    assert media.public_media_view(None, []) == {"coverAssetId": None, "blocks": []}


@pytest.mark.asyncio
async def test_approval_seals_media_and_publish_refuses_a_different_asset(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, title="Seramik", content="Seramik kaplama su gecirmez.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik kapak", caption="", public_allowed=True, image_bytes=_PNG)
    steps = _steps(knowledge)
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik kapak", "Seramik", steps)
    assert draft.media_plan["coverAssetId"] == str(image.id)
    for state in ("review", "approved"):
        draft = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, state, draft.revision)
    assert draft.media_plan["seal"] == media.media_seal(draft.media_plan)
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="seramik-yansi", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Seramik", card_date="2026-10-27",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    await sample.db.refresh(draft)

    def matching(_internal):
        return {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]}

    slug = node.slug
    revision = draft.revision
    monkeypatch.setattr("backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact", AsyncMock(return_value={"frozen": True}))
    monkeypatch.setattr("backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact", matching)
    published = await publish_draft(sample.db, sample.business.id, sample.owner.id, draft.id, slug, revision)
    assert published.scene_image_url is None
    await sample.db.refresh(draft)
    assert draft.media_plan["coverAssetId"] == str(image.id)

    replacement = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik kapak", "Seramik", steps)
    for state in ("review", "approved"):
        replacement = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, replacement.id, state, replacement.revision)
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, replacement.id)
    await sample.db.refresh(replacement)
    other_conversation = await sample.db.get(StandaloneConversation, replacement.conversation_id)
    other_node = MirrorNetworkNode(
        slug="seramik-degisti", user_id=replacement.created_by, conversation_id=other_conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Seramik", card_date="2026-10-27",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    changed = {"coverAssetId": replacement.media_plan["coverAssetId"], "blocks": [[{"type": "image", "assetId": str(uuid.uuid4())}], *replacement.media_plan["blocks"][1:]], "seal": replacement.media_plan["seal"]}
    replacement.media_plan = changed
    sample.db.add(other_node)
    await sample.db.commit()
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        lambda _internal: {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in replacement.steps]},
    )
    with pytest.raises(HTTPException) as mismatch:
        await publish_draft(sample.db, sample.business.id, sample.owner.id, replacement.id, other_node.slug, replacement.revision)
    assert mismatch.value.detail["code"] == "sealed_media_mismatch"


@pytest.mark.asyncio
async def test_revoked_media_drops_out_of_public_view_without_a_substitute(sample, asset_dir):
    knowledge = await source(sample, title="Seramik", content="Seramik kaplama su gecirmez.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik kapak", caption="", public_allowed=True, image_bytes=_PNG)
    other = await _asset(sample, knowledge, asset_type="image", title="Baska gorsel", caption="", public_allowed=True, image_bytes=_PNG + b"x")
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik kapak", "Seramik", _steps(knowledge))
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert str(other.id) not in str(draft.media_plan)
    visible = media.public_media_view(draft.media_plan, {str(image.id)})
    assert visible["coverAssetId"] == str(image.id)
    hidden = media.public_media_view(draft.media_plan, set())
    assert hidden["coverAssetId"] is None
    assert all(step == [] for step in hidden["blocks"])
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, image.id, image.revision)
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision)
    with pytest.raises(HTTPException) as unavailable:
        await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision)
    assert unavailable.value.detail["code"] == "sealed_media_unavailable"


@pytest.mark.asyncio
async def test_video_asset_can_be_selected_and_sealed_as_cover(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    image = await _asset(sample, knowledge, asset_type="image", title="Depo rafti", caption="", public_allowed=True, image_bytes=_PNG)
    video = await _asset(
        sample, knowledge, asset_type="video", title="Atolye filmi", caption="",
        locator="https://cdn.bilign.example/atolye.mp4", public_allowed=True,
    )
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge))
    assert draft.media_plan["coverAssetId"] == str(video.id)
    assert str(image.id) != draft.media_plan["coverAssetId"]
    assert "https://" not in str(draft.media_plan)
    assert "atolye.mp4" not in str(draft.media_plan)
    for state in ("review", "approved"):
        actor = sample.owner.id if state == "approved" else sample.editor.id
        draft = await svc.transition_draft(sample.db, sample.business.id, actor, draft.id, state, draft.revision)
    assert draft.media_plan["seal"] == media.media_seal(draft.media_plan)
    assert draft.media_plan["seal"] == svc.source_hash(media.media_identity(draft.media_plan))
    changed = {**draft.media_plan, "coverAssetId": str(image.id)}
    assert media.media_seal(changed) != draft.media_plan["seal"]


@pytest.mark.asyncio
async def test_sealed_video_cover_keeps_its_locator(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    video = await _asset(
        sample, knowledge, asset_type="video", title="Atolye filmi", caption="",
        locator="https://cdn.bilign.example/atolye.mp4", public_allowed=True,
    )
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge))
    for state in ("review", "approved"):
        actor = sample.owner.id if state == "approved" else sample.editor.id
        draft = await svc.transition_draft(sample.db, sample.business.id, actor, draft.id, state, draft.revision)
    sealed = draft.media_plan["seal"]
    sample.db.add(MirrorNetworkNode(
        slug="atolye-muhur", user_id=sample.owner.id, visibility="public", safety_status="open",
        card_title="Atolye", card_date="2026-10-28", public_payload={}, private_payload={},
    ))
    await sample.db.commit()
    from backend.models.business_yansi import BusinessPublication
    sample.db.add(BusinessPublication(
        slug="atolye-muhur", journey_version=1, business_id=sample.business.id, draft_id=draft.id,
        knowledge_snapshot=[], media_plan=draft.media_plan, published_by=sample.owner.id,
    ))
    await sample.db.commit()
    with pytest.raises(HTTPException) as blocked:
        await library.update_asset(sample.db, sample.business.id, sample.editor.id, video.id, {
            "title": video.title, "caption": "", "locator": "https://cdn.bilign.example/baska.mp4",
            "public_allowed": True, "revision": video.revision,
        })
    assert blocked.value.detail["code"] == "sealed_media_immutable"
    await sample.db.refresh(video)
    assert video.locator == "https://cdn.bilign.example/atolye.mp4"
    await sample.db.refresh(draft)
    assert draft.media_plan["coverAssetId"] == str(video.id)
    assert draft.media_plan["seal"] == sealed
    shown = await media.publication_media(sample.db, "atolye-muhur", 1)
    assert shown["cover"]["assetId"] == str(video.id)
    assert shown["cover"]["href"] == "https://cdn.bilign.example/atolye.mp4"
    fresh = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Yeni atolye filmi", "locator": "https://cdn.bilign.example/yeni.mp4", "public_allowed": True,
    })
    assert fresh.id != video.id
    shown_after = await media.publication_media(sample.db, "atolye-muhur", 1)
    assert shown_after["cover"]["assetId"] == str(video.id)
    assert shown_after["cover"]["href"] == "https://cdn.bilign.example/atolye.mp4"
    renamed = await library.update_asset(sample.db, sample.business.id, sample.editor.id, video.id, {
        "title": "Atolye filmi", "caption": "ayni adres", "locator": video.locator,
        "public_allowed": True, "revision": video.revision,
    })
    assert renamed.locator == video.locator
    revoked = await library.update_asset(sample.db, sample.business.id, sample.editor.id, renamed.id, {
        "title": renamed.title, "caption": renamed.caption, "locator": renamed.locator,
        "public_allowed": False, "revision": renamed.revision,
    })
    assert revoked.public_allowed is False
    assert revoked.locator == "https://cdn.bilign.example/atolye.mp4"
    hidden = await media.publication_media(sample.db, "atolye-muhur", 1)
    assert hidden is None or hidden["cover"] is None
    archived = await library.archive_asset(sample.db, sample.business.id, sample.editor.id, revoked.id, revoked.revision)
    assert archived.status == "archived"


@pytest.mark.asyncio
async def test_sealed_video_step_locator_cannot_change(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    image = await _asset(sample, knowledge, asset_type="image", title="Depo rafti", caption="", public_allowed=True, image_bytes=_PNG)
    video = await _asset(
        sample, knowledge, asset_type="video", title="Depo filmi", caption="",
        locator="https://cdn.bilign.example/adim.mp4", public_allowed=True,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Depo rafti", "Depo rafti", _steps(knowledge),
        media_choices=[[{"type": "video", "assetId": str(video.id)}]] + [[] for _ in range(7)],
        cover_asset_id=image.id,
    )
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert draft.media_plan["blocks"][0] == [{"type": "video", "assetId": str(video.id)}]
    for state in ("review", "approved"):
        actor = sample.owner.id if state == "approved" else sample.editor.id
        draft = await svc.transition_draft(sample.db, sample.business.id, actor, draft.id, state, draft.revision)
    with pytest.raises(HTTPException) as blocked:
        await library.update_asset(sample.db, sample.business.id, sample.editor.id, video.id, {
            "title": video.title, "locator": "https://cdn.bilign.example/baska-adim.mp4",
            "public_allowed": True, "revision": video.revision,
        })
    assert blocked.value.detail["code"] == "sealed_media_immutable"
    await sample.db.refresh(video)
    assert video.locator == "https://cdn.bilign.example/adim.mp4"
    assert draft.media_plan["seal"] == media.media_seal(draft.media_plan)


@pytest.mark.asyncio
async def test_explicit_cover_choice_beats_word_ranking(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    image = await _asset(sample, knowledge, asset_type="image", title="Depo rafti", caption="", public_allowed=True, image_bytes=_PNG)
    video = await _asset(
        sample, knowledge, asset_type="video", title="Atolye filmi", caption="",
        locator="https://cdn.bilign.example/atolye.mp4", public_allowed=True,
    )
    automatic = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge))
    assert automatic.media_plan["coverAssetId"] == str(video.id)
    chosen = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge),
        cover_asset_id=image.id,
    )
    assert chosen.media_plan["coverAssetId"] == str(image.id)
    assert "https://" not in str(chosen.media_plan)
    assert set(media.media_identity(chosen.media_plan)) == {"coverAssetId", "blocks"}
    assert media.media_seal(chosen.media_plan) == svc.source_hash(media.media_identity(chosen.media_plan))
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-kapak", "name": "Baska Kapak",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "video", "title": "Atolye filmi", "locator": "https://akdeniz.example/atolye.mp4", "public_allowed": True,
    })
    with pytest.raises(HTTPException) as rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge),
            cover_asset_id=foreign.id,
        )
    assert rejected.value.detail["code"] == "asset_choice_rejected"
    with pytest.raises(HTTPException) as url_rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge),
            cover_asset_id="https://cdn.bilign.example/atolye.mp4",
        )
    assert url_rejected.value.detail["code"] == "asset_choice_rejected"


@pytest.mark.asyncio
async def test_image_cover_wins_when_a_video_matches_equally(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    image = await _asset(sample, knowledge, asset_type="image", title="Atolye filmi", caption="", public_allowed=True, image_bytes=_PNG)
    await _asset(
        sample, knowledge, asset_type="video", title="Atolye filmi", caption="",
        locator="https://cdn.bilign.example/atolye.mp4", public_allowed=True,
    )
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge))
    assert draft.media_plan["coverAssetId"] == str(image.id)


@pytest.mark.asyncio
async def test_other_brand_video_cannot_become_the_cover(sample, asset_dir):
    knowledge = await source(sample, title="Atolye", content="Atolye filmi kaydi burada durur.")
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "akdeniz-video", "name": "Akdeniz Video",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "video", "title": "Atolye filmi", "locator": "https://akdeniz.example/atolye.mp4", "public_allowed": True,
    })
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge))
    assert draft.media_plan["coverAssetId"] is None
    draft.media_plan = {**draft.media_plan, "coverAssetId": str(foreign.id)}
    await sample.db.commit()
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision)
    with pytest.raises(HTTPException) as rejected:
        await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision)
    assert rejected.value.detail["code"] == "sealed_media_unavailable"


def test_video_cover_keeps_the_seal_formula_and_rejects_unsafe_urls():
    from types import SimpleNamespace

    cover = str(uuid.uuid4())
    plan = {"coverAssetId": cover, "blocks": [[{"type": "video", "assetId": cover}]], "href": "https://cdn.example/injected.mp4"}
    assert media.media_identity(plan) == {"coverAssetId": cover, "blocks": plan["blocks"]}
    assert media.media_seal(plan) == svc.source_hash(media.media_identity(plan))
    assert media.media_seal(plan) == media.media_seal({"coverAssetId": cover, "blocks": plan["blocks"]})
    asset = SimpleNamespace(
        asset_type="video", id=uuid.uuid4(), business_id=uuid.uuid4(), title="Film", caption="", locator="http://cdn.example/a.mp4",
    )
    assert media.public_block(asset) is None
    asset.locator = "https://user:pass@cdn.example/a.mp4"
    assert media.public_block(asset) is None
    asset.locator = "https://127.0.0.1/a.mp4"
    assert media.public_block(asset) is None
    asset.locator = "https://cdn.bilign.example/atolye.mp4"
    block = media.public_block(asset)
    assert block["type"] == "video" and block["href"] == asset.locator and "locator" not in block


def test_question_answer_seal_stays_ahead_of_the_media_seal():
    text = Path(__file__).parent.parent.joinpath("services/business_yansi/publication.py").read_text(encoding="utf-8")
    assert text.index("sealed_draft_mismatch") < text.index("sealed_media_mismatch")


def test_media_plan_migration_follows_brand_assets():
    path = Path(__file__).parent.parent / "migrations/versions/add_business_yansi_media_plan_v1.py"
    spec = importlib.util.spec_from_file_location("media_plan_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "add_business_brand_assets_v1"
    upgrade_sql = io.StringIO()
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": upgrade_sql})
    with Operations.context(context):
        migration.upgrade()
    sql = upgrade_sql.getvalue()
    assert "business_yansi_drafts" in sql and "media_plan" in sql
    assert "DROP TABLE" not in sql
    assert "business_knowledge_chunks" not in sql
