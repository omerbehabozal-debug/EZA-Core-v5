"""Yansı V2 Stage 03B — AI conversation proposal via existing Studio execution.

Mock provider only. Does not create V1 drafts or silently publish.
"""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import func, select

from backend.auth.deps import get_current_user
from backend.core.schemas.business_studio import TopicsRequest
from backend.core.utils.dependencies import Base, get_db
from backend.models.business_yansi import BusinessYansiDraft
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.routers import yansi_v2 as routes
from backend.services.business_yansi import studio, studio_execution as execution
from backend.services.business_yansi import studio_generation as generation
from backend.services.yansi import ai_conversation_proposal_v2 as v2ai
from backend.services.yansi import conversation_draft_v2 as drafts
from backend.tests.test_business_yansi import sample  # noqa: F401
from backend.tests.test_business_studio import env, request  # noqa: F401
from backend.tests.test_business_studio_generation import fake, ready, reply  # noqa: F401


async def _ensure_v2_draft_table(db):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[YansiV2ConversationDraft.__table__],
        )

    await db.run_sync(create)


def _passages(job):
    return v2ai.catalog_v2(job.source_snapshot)


def _proposal_value(passages, turn_count=3, paraphrase=True):
    keys = [k for k, e in passages.items() if generation.answer_eligible(e)]
    assert keys, "fixture must yield eligible passages"
    keys = keys[:turn_count]
    turns = []
    for i, key in enumerate(keys, start=1):
        text = passages[key]["text"].strip()
        question = f"How does the workshop cover topic number {i} in practice today?"
        if paraphrase:
            # Keep high token overlap with evidence while not being a verbatim copy.
            answer = f"In short, {text}"
        else:
            answer = "Completely unrelated fabricated warranty and secret price guarantee."
        turns.append({
            "stepIndex": i,
            "question": question,
            "answer": answer,
            "evidence": [{"passageId": key}],
            "mediaSuggestions": [],
        })
    return {
        "title": "Workshop care guide",
        "summary": "Grounded workshop product care overview.",
        "curiosityQuestion": turns[0]["question"],
        "turns": turns,
        "coverAssetId": None,
        "coverReason": "",
        "rationale": "Coverage matched available verified passages.",
    }


async def _run_proposal(s, *, turn_count=3, paraphrase=True, key="v2-prop-001"):
    body = TopicsRequest(
        idempotencyKey=key,
        sourceVersionIds=[s.knowledge.id],
        topicHint="workshop care",
    )
    job = await studio.create_job(s.db, s.business.id, s.owner.id, body, v2ai.KIND)
    passages = _passages(job)
    value = _proposal_value(passages, turn_count=turn_count, paraphrase=paraphrase)
    provider = fake(reply(value))
    row = await execution.execute(s.db, job, router=provider)
    return row, provider, passages


@pytest.mark.asyncio
async def test_v2_proposal_flexible_turns_no_v1_draft(ready):
    s = ready
    row, provider, _ = await _run_proposal(s, turn_count=3)
    assert row.status == "succeeded"
    assert row.kind == "v2_prop"
    assert row.draft_id is None
    assert provider.generate.await_count == 1
    result = row.execution["result"]
    assert result["insufficientSources"] is False
    turns = result["result"]["turns"]
    assert 1 <= len(turns) <= 8
    assert len(turns) == 3
    assert all(t["claimSafety"] == "grounded" for t in turns)
    assert await s.db.scalar(select(func.count(BusinessYansiDraft.id))) == 0


@pytest.mark.asyncio
async def test_v2_proposal_flags_unsupported_claims(ready):
    s = ready
    row, _, _ = await _run_proposal(s, turn_count=2, paraphrase=False, key="v2-prop-weak")
    assert row.status == "succeeded"
    envelope = row.execution["result"]
    assert any(w["code"] == "unsupported_claim" for w in envelope["warnings"])
    assert all(t["claimSafety"] == "unsupported" for t in envelope["result"]["turns"])


@pytest.mark.asyncio
async def test_apply_creates_v2_draft_not_auto_on_settle(ready):
    s = ready
    await _ensure_v2_draft_table(s.db)
    row, _, _ = await _run_proposal(s, turn_count=2, key="v2-prop-apply")
    assert await s.db.scalar(select(func.count(YansiV2ConversationDraft.id))) == 0

    applied = await v2ai.apply_conversation_proposal_v2(
        s.db,
        business_id=str(s.business.id),
        actor_user_id=str(s.owner.id),
        generation_id=str(row.id),
    )
    assert applied["status"] == "applied"
    draft = applied["draft"]
    assert draft["status"] == "draft"
    assert draft["revision"] == 1
    assert len(draft["turns"]) == 2
    assert draft["curiosityQuestion"] == draft["turns"][0]["question"]
    assert draft["knowledgeSourcePins"]
    assert await s.db.scalar(select(func.count(YansiV2ConversationDraft.id))) == 1
    assert await s.db.scalar(select(func.count(BusinessYansiDraft.id))) == 0


@pytest.mark.asyncio
async def test_apply_revises_existing_draft(ready):
    s = ready
    await _ensure_v2_draft_table(s.db)
    created = await drafts.create_conversation_draft_v2(
        s.db,
        business_id=str(s.business.id),
        actor_user_id=str(s.owner.id),
        title="Manual seed",
        summary="",
        turns=[
            {
                "stepIndex": 1,
                "question": "Seed question one for workshop?",
                "answer": "Seed answer one about workshop.",
            }
        ],
    )
    row, _, _ = await _run_proposal(s, turn_count=3, key="v2-prop-revise")
    applied = await v2ai.apply_conversation_proposal_v2(
        s.db,
        business_id=str(s.business.id),
        actor_user_id=str(s.owner.id),
        generation_id=str(row.id),
        draft_id=created["id"],
        expected_revision=created["revision"],
    )
    assert applied["draft"]["id"] == created["id"]
    assert applied["draft"]["revision"] == 2
    assert len(applied["draft"]["turns"]) == 3
    assert applied["draft"]["title"] == "Workshop care guide"


@pytest.mark.asyncio
async def test_validate_proposal_turn_count_one_to_eight():
    snapshot = {
        "sources": [
            {
                "versionId": "11111111-1111-4111-8111-111111111111",
                "version": 1,
                "contentHash": "a" * 64,
                "content": (
                    "The workshop selects durable materials for its verified product designs.\n\n"
                    "Customers can request a product repair through the workshop service.\n\n"
                    "Product care instructions are supplied with each verified product."
                ),
            }
        ]
    }
    passages = v2ai.catalog_v2(snapshot)
    for n in (1, 4, 8):
        value = _proposal_value(passages, turn_count=min(n, len([
            k for k, e in passages.items() if generation.answer_eligible(e)
        ])))
        out = v2ai.validate_proposal(
            {"insufficientSources": False, "result": value},
            passages,
            snapshot,
            media={},
        )
        assert out["insufficientSources"] is False
        assert 1 <= len(out["result"]["turns"]) <= 8


@pytest.mark.asyncio
async def test_v1_topics_path_unchanged(ready):
    """Regression: V1 topics admission/execution still works beside v2_prop."""
    s = ready
    job = await studio.create_job(s.db, s.business.id, s.owner.id, request(s, key="v1-topics-reg"), "topics")
    passages = generation.catalog(job.source_snapshot)
    keys = [k for k, e in passages.items() if generation.answer_eligible(e)]
    titles = list(passages)
    value = {
        "topics": [
            {"titlePassageId": titles[0], "descriptionPassageId": keys[0], "answerPassageIds": keys},
            {"titlePassageId": titles[1], "descriptionPassageId": keys[1], "answerPassageIds": keys},
        ]
    }
    row = await execution.execute(s.db, job, router=fake(reply(value)))
    assert row.status == "succeeded" and row.kind == "topics"
    assert len(row.execution["result"]["topics"]) == 2


def _app(db, user_id: str) -> FastAPI:
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": user_id, "role": "user"}
    return app


@pytest.mark.asyncio
async def test_http_proposal_and_apply(ready, monkeypatch):
    s = ready
    await _ensure_v2_draft_table(s.db)
    monkeypatch.setenv("BILIGN_BUSINESS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_STUDIO_ADMISSION_ENABLED", "true")
    monkeypatch.setenv("BILIGN_STUDIO_EXECUTION_ENABLED", "true")
    monkeypatch.setenv("BILIGN_STUDIO_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setenv(
        "BILIGN_STUDIO_PRICES_JSON",
        json.dumps({"openai/gpt-4o-mini": {"inputPerMillion": ".15", "outputPerMillion": ".60"}}),
    )

    # Full HTTP create → get → apply with mock ModelRouter (no paid API).
    body = TopicsRequest(
        idempotencyKey="v2-http-create-001",
        sourceVersionIds=[s.knowledge.id],
        topicHint="workshop care",
    )
    # Build passages from a dry snapshot for the mock reply.
    snapshot, _ = await studio.snapshot_sources(s.db, s.business.id, [s.knowledge.id])
    passages = v2ai.catalog_v2(snapshot)
    provider = fake(reply(_proposal_value(passages, turn_count=2)))
    monkeypatch.setattr(execution, "ModelRouter", lambda: provider)

    app = _app(s.db, str(s.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        created = await client.post(
            f"/api/business-yansi/{s.business.id}/v2/ai/conversation-proposals",
            json=body.model_dump(mode="json"),
        )
        assert created.status_code == 200, created.text
        created_body = created.json()
        assert created_body["kind"] == "v2_prop"
        assert created_body["status"] == "completed"
        assert created_body["proposal"]["result"]["turns"]
        assert len(created_body["proposal"]["result"]["turns"]) == 2
        generation_id = created_body["generationId"]
        assert provider.generate.await_count == 1

        got = await client.get(
            f"/api/business-yansi/{s.business.id}/v2/ai/conversation-proposals/{generation_id}",
        )
        assert got.status_code == 200, got.text
        assert got.json()["proposal"]["result"]["turns"]

        applied = await client.post(
            f"/api/business-yansi/{s.business.id}/v2/ai/conversation-proposals/{generation_id}/apply",
            json={},
        )
        assert applied.status_code == 200, applied.text
        data = applied.json()
        assert data["status"] == "applied"
        assert data["draft"]["status"] == "draft"
        assert len(data["draft"]["turns"]) == 2
        assert await s.db.scalar(select(func.count(BusinessYansiDraft.id))) == 0
