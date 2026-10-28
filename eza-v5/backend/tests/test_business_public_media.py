"""Public Yansı and chat media stay authorized, brand-scoped, and text-compatible."""
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.routers.business_yansi import public_brand_media
from backend.services.business_yansi import studio_media as media
from backend.tests.test_business_studio_media import _PNG, _asset, _steps
from backend.tests.test_business_yansi import sample, source


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


def _node(owner_id, slug):
    return MirrorNetworkNode(
        slug=slug, user_id=owner_id, visibility="public", safety_status="open",
        card_title="Seramik", card_date="2026-10-28", public_payload={}, private_payload={},
    )


@pytest.mark.asyncio
async def test_public_media_is_reauthorized_and_hides_storage_keys(sample, asset_dir):
    knowledge = await source(sample, content="Seramik atolyesi hafta sonu aciktir.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik atolyesi", caption="Kapak", public_allowed=True, image_bytes=_PNG)
    video = await _asset(sample, knowledge, asset_type="video", title="Seramik atolyesi filmi", caption="", locator="https://cdn.bilign.example/seramik.mp4", public_allowed=True)
    place = await _asset(sample, knowledge, asset_type="place", title="Seramik atolyesi", caption="Kadikoy", latitude="40.9900", longitude="29.0200", public_allowed=True)
    await _asset(sample, knowledge, asset_type="link", title="Baska konu", locator="https://bilign.example/diger", public_allowed=True)
    shown = await media.answer_media(sample.db, sample.business.id, "Seramik atolyesi nerede?", [{
        "knowledge_version_id": str(knowledge.id), "chunk_id": "c1", "title": knowledge.title,
    }])
    kinds = {block["type"] for block in shown}
    assert {"image", "video", "map"} <= kinds
    assert "link" not in kinds
    assert all("brand-assets" not in str(block) and "locator" not in block for block in shown)
    image_block = next(block for block in shown if block["type"] == "image")
    assert image_block["contentPath"] == f"/api/business-yansi/public-media/{sample.business.id}/{image.id}"
    body = library.read_stored_image(sample.business.id, image.locator)
    response = await public_brand_media(sample.business.id, image.id, sample.db)
    assert response.body == body[0] and "brand-assets" not in response.headers.get("content-type", "")
    assert await media.answer_media(sample.db, uuid.uuid4(), "Seramik atolyesi", [{"knowledge_version_id": str(knowledge.id)}]) == []
    with pytest.raises(HTTPException) as hidden:
        await public_brand_media(uuid.uuid4(), image.id, sample.db)
    assert hidden.value.status_code == 404
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, image.id, image.revision)
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, video.id, video.revision)
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, place.id, place.revision)
    assert await media.answer_media(sample.db, sample.business.id, "Seramik atolyesi nerede?", [{"knowledge_version_id": str(knowledge.id)}]) == []
    with pytest.raises(HTTPException) as archived:
        await public_brand_media(sample.business.id, image.id, sample.db)
    assert archived.value.status_code == 404


@pytest.mark.asyncio
async def test_published_yansi_drops_revoked_media_and_keeps_text_plans(sample, asset_dir):
    knowledge = await source(sample, content="Seramik atolyesi hafta sonu aciktir.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik atolyesi", caption="", public_allowed=True, image_bytes=_PNG)
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Seramik atolyesi", "Seramik atolyesi ozeti", _steps(knowledge))
    sample.db.add(_node(sample.owner.id, "seramik-yansi"))
    sample.db.add(_node(sample.owner.id, "metin-yansi"))
    await sample.db.commit()
    sample.db.add(BusinessPublication(
        slug="seramik-yansi", journey_version=1, business_id=sample.business.id, draft_id=draft.id,
        knowledge_snapshot=[], media_plan=draft.media_plan, published_by=sample.owner.id,
    ))
    sample.db.add(BusinessPublication(
        slug="metin-yansi", journey_version=1, business_id=sample.business.id, draft_id=draft.id,
        knowledge_snapshot=[], media_plan=None, published_by=sample.owner.id,
    ))
    await sample.db.commit()
    shown = await media.publication_media(sample.db, "seramik-yansi", 1)
    assert shown["cover"]["contentPath"].endswith(str(image.id))
    assert "brand-assets" not in str(shown)
    assert await media.publication_media(sample.db, "metin-yansi", 1) is None
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, image.id, image.revision)
    hidden = await media.publication_media(sample.db, "seramik-yansi", 1)
    assert hidden is None or hidden["cover"] is None
    assert str(image.id) not in str(hidden)


def test_public_media_route_does_not_require_a_user():
    from backend.routers import business_yansi as routes
    route = next(item for item in routes.router.routes if getattr(item, "path", "") == "/api/business-yansi/public-media/{business_id}/{asset_id}")
    dependencies = [getattr(item, "call", None) for item in route.dependant.dependencies]
    assert routes.get_current_user not in dependencies


@pytest.mark.asyncio
async def test_reopened_chat_restores_only_the_same_live_media(sample, asset_dir, monkeypatch):
    from unittest.mock import AsyncMock
    from backend.core.schemas.standalone_conversations import StandaloneConversationMessageCreate
    from backend.models.standalone_conversations import StandaloneConversation, StandaloneConversationMessage
    from backend.services.standalone.conversations import append_standalone_message, get_standalone_conversation_detail
    from backend.services.standalone.generation_persistence import GenerationPersistenceContext, persist_assistant_turn_after_generation

    knowledge = await source(sample, content="Seramik atolyesi hafta sonu aciktir.")
    image = await _asset(sample, knowledge, asset_type="image", title="Seramik atolyesi", caption="", public_allowed=True, image_bytes=_PNG)
    video = await _asset(sample, knowledge, asset_type="video", title="Seramik atolyesi filmi", caption="", locator="https://cdn.bilign.example/seramik.mp4", public_allowed=True)
    extra = await _asset(sample, knowledge, asset_type="image", title="Seramik atolyesi yedek", caption="", public_allowed=True, image_bytes=_PNG + b"y")
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "akdeniz", "name": "Akdeniz",
    })
    other.verified = True
    await sample.db.commit()
    foreign_knowledge = await svc.create_knowledge(sample.db, other.id, sample.outsider.id, {
        "title": "Akdeniz", "content": "Akdeniz seramik atolyesi.", "source": "Akdeniz", "publicAllowed": True,
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "image", "title": "Akdeniz seramik", "public_allowed": True,
    }, image_bytes=_PNG + b"z")
    foreign = await library.set_links(sample.db, other.id, sample.outsider.id, foreign.id, [foreign_knowledge.id], foreign.revision)
    conversation = StandaloneConversation(
        id=uuid.uuid4(), user_id=sample.owner.id, client_conversation_id="seramik-sohbet",
        conversation_type="mirror", message_count=0, title_pinned=False, pinned=False,
        tree_metadata={"publicReplaySelection": {"slug": "seramik-yansi", "journeyVersion": 1, "completedStepCount": 0}},
    )
    sample.db.add(conversation)
    await sample.db.commit()
    context = GenerationPersistenceContext(sample.owner.id, conversation.id, "user-1", "assistant-1")
    await persist_assistant_turn_after_generation(
        sample.db, context, content="Seramik atolyesi aciktir.", assistant_score=90,
        business_media_asset_ids=[str(image.id), "https://cdn.bilign.example/secret.mp4", str(video.id), "brand-assets/secret.png", str(foreign.id)],
    )
    await append_standalone_message(sample.db, user_id=sample.owner.id, conversation_id=conversation.id, body=StandaloneConversationMessageCreate(
        clientMessageId="user-2", role="user", content="Tesekkurler",
    ))
    await persist_assistant_turn_after_generation(
        sample.db, GenerationPersistenceContext(sample.owner.id, conversation.id, "user-2", "assistant-2"),
        content="Rica ederim.", assistant_score=90,
    )
    from sqlalchemy import select
    stored = (await sample.db.scalars(select(StandaloneConversationMessage).where(
        StandaloneConversationMessage.conversation_id == conversation.id
    ).order_by(StandaloneConversationMessage.sequence))).all()
    assert [row.sequence for row in stored] == [1, 2, 3]
    durable = stored[0].message_metadata["businessMediaAssetIds"]
    assert durable == [str(image.id), str(video.id), str(foreign.id)]
    assert "http" not in str(durable) and "brand-assets" not in str(stored[0].message_metadata)
    assert "latitude" not in stored[0].message_metadata and "locator" not in stored[0].message_metadata

    async def publisher(db, selection):
        return {"slug": selection.slug, "journeyVersion": 1, "completedStepCount": 0, "publicTitle": "Seramik",
                "authorUserId": str(sample.business.id), "steps": [],
                "businessPublisher": {"businessId": str(sample.business.id), "slug": "bilign", "displayName": "BiligN", "logoUrl": None, "verified": True, "official": True}}

    monkeypatch.setattr("backend.services.mirror_network.public_replay_continuation.resolve_public_replay_context", publisher)
    monkeypatch.setattr("backend.services.standalone.conversations.preparation_flags_for_conversations", AsyncMock(return_value={}))
    opened = await get_standalone_conversation_detail(sample.db, user_id=sample.owner.id, conversation_id=conversation.id)
    assert [message.sequence for message in opened.messages] == [1, 2, 3]
    assert [message.content for message in opened.messages] == ["Seramik atolyesi aciktir.", "Tesekkurler", "Rica ederim."]
    assert [block.assetId for block in opened.messages[0].businessMedia] == [str(image.id), str(video.id)]
    assert opened.messages[1].businessMedia is None and opened.messages[2].businessMedia is None
    assert "brand-assets" not in str(opened.messages[0].businessMedia)
    assert str(extra.id) not in str(opened.messages[0].businessMedia)
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, image.id, image.revision)
    again = await get_standalone_conversation_detail(sample.db, user_id=sample.owner.id, conversation_id=conversation.id)
    assert [block.assetId for block in again.messages[0].businessMedia] == [str(video.id)]
    assert str(foreign.id) not in str(again.messages[0].businessMedia)


def test_media_attachment_does_not_spend_the_daily_brand_quota():
    root = Path(__file__).resolve().parents[1]
    assert "consume_business_brand_message" not in (root / "services/business_yansi/studio_media.py").read_text(encoding="utf-8")
    assert "consume_business_brand_message" not in (root / "api/streaming.py").read_text(encoding="utf-8")
    assert "package_answers" not in (root / "services/business_yansi/studio_media.py").read_text(encoding="utf-8")
