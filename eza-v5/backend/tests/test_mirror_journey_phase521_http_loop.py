# -*- coding: utf-8 -*-
"""Phase 5.2.1 — HTTP / integration closure for the Yansı network loop.

Proves the production contracts connect:

  published frozen A
    → real POST /{A}/sohbet/session (continuation proof)
    → Bob's NEW live 6–8 Q/A (A replay excluded)
    → real POST /publish (Phase 3.7 Review contract)
    → durable B.parentSlug from verified origin (not client assignment)
    → fresh GET /{A}/children contains B
    → fresh GET /{B}/frozen is Bob's selected replay-ready Q/A

Persistence is in-memory. Parent resolution, publish/freeze, children
eligibility, and frozen public projection are the real services.
"""

from __future__ import annotations

import json
import uuid
from contextlib import ExitStack
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.models.production import User
from backend.security.rate_limit import rate_limit_standalone
from backend.services.mirror.journey_generation_record import (
    clear_journey_generation_records_for_tests,
)
from backend.services.mirror_network.fixtures import JAPAN_FIXTURE_BUNDLE
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.production_auth import create_access_token


ALICE_REPLAY_TAG = "AliceReplay"
BOB_LIVE_TAG = "BobLive"
GUEST_BOB = "bob-guest-token-phase521xx"
SCENE_PREFIX = "https://api.test.eza.ai/api/public/mirror-scene-assets"

PRIVACY_FORBIDDEN_KEYS = {
    "sourceUserMessageId",
    "sourceAssistantMessageId",
    "source_user_message_id",
    "source_assistant_message_id",
    "questionHash",
    "answerHash",
    "lineageProofToken",
    "guestToken",
    "relationshipMap",
    "relationship_map",
    "conversationId",
    "sourceConversationId",
    "intelligenceBrief",
    "behavioralSnapshot",
    "private_payload",
    "mirrorBody",
}


@pytest.fixture(autouse=True)
def _clear_gen_records():
    clear_journey_generation_records_for_tests()
    yield
    clear_journey_generation_records_for_tests()


class _Result:
    def __init__(self, rows: list[Any]):
        self._rows = list(rows)

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalar(self):
        return self._rows[0] if self._rows else None


class NetworkStore:
    """In-memory persistence for nodes, proofs, frozen steps, and users."""

    def __init__(self) -> None:
        self.nodes: dict[str, Any] = {}
        self.proofs: dict[uuid.UUID, Any] = {}
        self.steps: dict[tuple[str, int], list[dict[str, Any]]] = {}
        self.users: dict[uuid.UUID, Any] = {}
        self.last_slug_lookup: str | None = None
        self.db = FakeDb(self)

    async def get_by_slug(self, _db, slug: str):
        normalized = (slug or "").strip().lower()
        self.last_slug_lookup = normalized
        return self.nodes.get(normalized)

    async def get_by_slug_for_user(self, _db, *, user_id, slug: str):
        node = self.nodes.get((slug or "").strip().lower())
        if node is None or getattr(node, "user_id", None) != user_id:
            return None
        return node

    async def slug_exists(self, _db, slug: str) -> bool:
        return (slug or "").strip().lower() in self.nodes

    async def create_node(self, _db, node, commit: bool = True):
        if getattr(node, "id", None) is None:
            node.id = uuid.uuid4()
        slug = str(node.slug).strip().lower()
        node.slug = slug
        if getattr(node, "created_at", None) is None:
            node.created_at = datetime.now(timezone.utc)
        self.nodes[slug] = node
        return node

    async def update_node(self, _db, node, commit: bool = True):
        slug = str(getattr(node, "slug", "") or "").strip().lower()
        if slug:
            self.nodes[slug] = node
        return node

    async def get_by_conversation(self, _db, *, user_id, conversation_id: str):
        conv = (conversation_id or "").strip()
        matches = [
            n
            for n in self.nodes.values()
            if getattr(n, "user_id", None) == user_id
            and (getattr(n, "conversation_id", None) or "").strip() == conv
            and (getattr(n, "artifact_kind", None) or "") != ARTIFACT_KIND_JOURNEY_V1
        ]
        matches.sort(
            key=lambda n: n.created_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        return matches[0] if matches else None

    async def list_journeys(self, _db, *, user_id, conversation_id: str):
        conv = (conversation_id or "").strip()
        rows = [
            n
            for n in self.nodes.values()
            if getattr(n, "user_id", None) == user_id
            and (getattr(n, "conversation_id", None) or "").strip() == conv
            and (getattr(n, "artifact_kind", None) or "") == ARTIFACT_KIND_JOURNEY_V1
        ]
        rows.sort(key=lambda n: n.created_at or datetime.min.replace(tzinfo=timezone.utc))
        return rows

    async def get_proof(self, _db, proof_id: uuid.UUID):
        return self.proofs.get(proof_id)

    async def consume_proof(self, _db, *, proof_id, user_id, conversation_id):
        proof = self.proofs.get(proof_id)
        if proof is None or getattr(proof, "consumed_at", None) is not None:
            return None
        now = datetime.now(timezone.utc)
        expires = proof.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            return None
        proof.consumed_at = now
        proof.conversation_id = conversation_id
        proof.user_id = user_id
        return proof

    async def replace_steps(
        self,
        _db,
        *,
        journey_slug,
        journey_version,
        steps,
        **_kwargs,
    ):
        key = ((journey_slug or "").strip().lower(), int(journey_version))
        self.steps[key] = [dict(s) for s in steps]
        return "in-memory-eza-hash"

    async def list_steps(self, _db, *, journey_slug, journey_version):
        rows = self.steps.get(
            ((journey_slug or "").strip().lower(), int(journey_version)),
            [],
        )
        return [
            {
                "stepIndex": int(s["stepIndex"]),
                "sourceOrder": s.get("sourceOrder"),
                "sourceUserMessageId": s.get("sourceUserMessageId"),
                "sourceAssistantMessageId": s.get("sourceAssistantMessageId"),
                "publicQuestion": s["publicQuestion"],
                "publicAnswer": s["publicAnswer"],
                "questionHash": s.get("questionHash"),
                "answerHash": s.get("answerHash"),
                "sanitizationFlags": s.get("sanitizationFlags"),
                "ezaSnapshot": s.get("ezaSnapshot"),
            }
            for s in rows
        ]

    async def lineage_hash(self, _db, *, journey_slug, journey_version):
        rows = self.steps.get(
            ((journey_slug or "").strip().lower(), int(journey_version)),
            [],
        )
        if not rows:
            return None
        flags = rows[0].get("sanitizationFlags")
        if isinstance(flags, dict):
            stored = str(flags.get("lineageSelectedStepsHash") or "").strip()
            return stored or None
        return None


def _clause_bind_values(clause) -> list[Any]:
    out: list[Any] = []
    if clause is None:
        return out
    type_name = type(clause).__name__
    if type_name == "BindParameter" or (
        hasattr(clause, "key") and hasattr(clause, "value") and not hasattr(clause, "table")
    ):
        out.append(getattr(clause, "value", None))
        return out
    for attr in ("clauses", "clause_expr", "element", "left", "right"):
        inner = getattr(clause, attr, None)
        if inner is None or inner is clause:
            continue
        if isinstance(inner, (list, tuple)):
            for item in inner:
                out.extend(_clause_bind_values(item))
        else:
            out.extend(_clause_bind_values(inner))
    return [v for v in out if v is not None]


def _clause_column_names(clause) -> set[str]:
    names: set[str] = set()
    if clause is None:
        return names
    name = getattr(clause, "name", None) or getattr(clause, "key", None)
    if isinstance(name, str):
        names.add(name)
    for attr in ("clauses", "clause_expr", "element", "left", "right"):
        inner = getattr(clause, attr, None)
        if inner is None or inner is clause:
            continue
        if isinstance(inner, (list, tuple)):
            for item in inner:
                names.update(_clause_column_names(item))
        else:
            names.update(_clause_column_names(inner))
    return names


class FakeDb:
    def __init__(self, store: NetworkStore):
        self.store = store

    def add(self, obj) -> None:
        if getattr(obj, "source_mirror_slug", None) is not None and getattr(
            obj, "actor_hash", None
        ):
            self.store.proofs[obj.id] = obj
            return
        slug = getattr(obj, "slug", None)
        if slug:
            self.store.nodes[str(slug).strip().lower()] = obj

    async def commit(self) -> None:
        return None

    async def refresh(self, _obj) -> None:
        return None

    async def flush(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def get(self, model, pk):
        if model is User or getattr(model, "__name__", "") == "User":
            return self.store.users.get(pk)
        return None

    async def execute(self, stmt):
        """Serve ORM selects from the in-memory store without compiling SQL."""
        mentions_parent = False
        bind_values: list[Any] = []
        for crit in getattr(stmt, "_where_criteria", ()) or ():
            names = _clause_column_names(crit)
            if "parent_slug" in names:
                mentions_parent = True
            bind_values.extend(_clause_bind_values(crit))
        if ARTIFACT_KIND_JOURNEY_V1 in bind_values and FREEZE_STATUS_FROZEN in bind_values:
            mentions_parent = True

        if mentions_parent:
            parents = {
                str(v).strip().lower()
                for v in bind_values
                if isinstance(v, str)
                and v not in {ARTIFACT_KIND_JOURNEY_V1, FREEZE_STATUS_FROZEN, "legacy_landing"}
            }
            if not parents and getattr(self.store, "last_slug_lookup", None):
                parents = {self.store.last_slug_lookup}
            rows = [
                n
                for n in self.store.nodes.values()
                if (getattr(n, "parent_slug", None) or "").strip().lower() in parents
                and getattr(n, "published_at", None) is not None
                and (getattr(n, "artifact_kind", None) or "") == ARTIFACT_KIND_JOURNEY_V1
                and (getattr(n, "freeze_status", None) or "") == FREEZE_STATUS_FROZEN
            ]
            rows.sort(key=lambda n: n.slug)
            rows.sort(
                key=lambda n: n.created_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            rows.sort(
                key=lambda n: n.published_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            return _Result(rows)

        user_ids = [v for v in bind_values if isinstance(v, uuid.UUID)]
        slugs = [
            str(v).strip().lower()
            for v in bind_values
            if isinstance(v, str)
            and v not in {ARTIFACT_KIND_JOURNEY_V1, FREEZE_STATUS_FROZEN, "legacy_landing"}
        ]
        if user_ids and not slugs:
            uid = user_ids[0]
            rows = [
                n for n in self.store.nodes.values() if getattr(n, "user_id", None) == uid
            ]
            rows.sort(
                key=lambda n: n.created_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            rows.sort(
                key=lambda n: n.published_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            return _Result(rows)
        if slugs:
            rows = [self.store.nodes[s] for s in slugs if s in self.store.nodes]
            if user_ids:
                rows = [n for n in rows if getattr(n, "user_id", None) == user_ids[0]]
            return _Result(rows)
        return _Result([])


def _user(*, email: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        email=email,
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _auth(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _scene_url() -> tuple[str, str]:
    asset_id = str(uuid.uuid4())
    return asset_id, f"{SCENE_PREFIX}/{asset_id}.png"


def _live_steps(
    *,
    tag: str,
    selected_count: int = 8,
    start: int = 0,
    eza_score: int | None = None,
) -> list[dict[str, Any]]:
    skip = set(range(selected_count, 8))
    out: list[dict[str, Any]] = []
    idx = 0
    for i in range(8):
        if i in skip:
            continue
        idx += 1
        assistant_id = f"a{tag}{start + i + 1}"
        user_id = f"u{tag}{start + i + 1}"
        row: dict[str, Any] = {
            "stepIndex": idx,
            "sourceOrder": start + i,
            "sourceUserMessageId": user_id,
            "sourceAssistantMessageId": assistant_id,
            "publicQuestion": f"{tag} soru {start + i + 1}?",
            "publicAnswer": f"{tag} cevap {start + i + 1}.",
        }
        if eza_score is not None:
            row["ezaSnapshot"] = {
                "assistantScore": eza_score,
                "sourceAssistantMessageId": assistant_id,
            }
        out.append(row)
    return out


def _attach_generation_lineage(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.services.mirror.journey_generation_lineage import (
        build_journey_generation_lineage,
        recompute_hashes_from_steps,
    )
    from backend.services.mirror.journey_generation_record import (
        upsert_journey_generation_record,
    )
    from backend.services.mirror.public_landing_hash import (
        compute_public_landing_hash,
        extract_public_landing_from_curiosity,
    )

    journey_id = str(payload.get("journeyId") or "").strip().lower()
    steps = payload.get("selectedSteps") or _live_steps(tag=ALICE_REPLAY_TAG)
    window_index = int(payload.get("windowIndex", 0))
    window_start = int(payload.get("windowStart", 0))
    window_end = int(payload.get("windowEnd", 7))
    version = int(payload.get("journeyVersion") or 1)
    conv = str(payload.get("conversationId") or "conv-phase521")
    scene_asset_id = str(payload.get("sceneAssetId") or "")
    scene_url = str(payload.get("sceneImageUrl") or "")
    if not scene_asset_id or not scene_url:
        scene_asset_id, scene_url = _scene_url()
        payload["sceneAssetId"] = scene_asset_id
        payload["sceneImageUrl"] = scene_url

    bundle = dict(payload.get("curiosityBundle") or {})
    if not isinstance(bundle.get("publicLanding"), dict):
        bundle["publicLanding"] = {
            "publicTitle": str(payload.get("cardTitle") or "Phase 521"),
            "publicSummary": "Bob continues from Alice's published Yansı.",
            "continuationContext": "Yeni sorularla devam.",
            "contractVersion": "mirror-public-landing-v1",
            "semanticSource": "d2_interpretation",
        }
        payload["curiosityBundle"] = bundle

    landing_fields = extract_public_landing_from_curiosity(bundle)
    landing_hash = compute_public_landing_hash(landing_fields)
    hashes = recompute_hashes_from_steps(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=steps,
    )
    generation_id = str(payload.get("generationId") or f"gen-{journey_id}-v{version}")
    interp = str(payload.get("interpretationHash") or f"interp-{journey_id}")
    mapped = str(payload.get("mappedPromptHash") or f"prompt-{journey_id}")
    lineage = build_journey_generation_lineage(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        window_hash=hashes["windowHash"],
        scoped_input_hash=hashes["scopedInputHash"],
        selected_steps_hash=hashes["selectedStepsHash"],
        generation_id=generation_id,
        interpretation_hash=interp,
        public_landing_hash=landing_hash,
        mapped_prompt_hash=mapped,
        scene_asset_id=scene_asset_id,
    )
    upsert_journey_generation_record(
        generation_id,
        {
            "journeyId": journey_id,
            "journeyVersion": version,
            "sourceConversationId": conv,
            "windowIndex": window_index,
            "windowStart": window_start,
            "windowEnd": window_end,
            "windowHash": hashes["windowHash"],
            "scopedInputHash": hashes["scopedInputHash"],
            "selectedStepsHash": hashes["selectedStepsHash"],
            "interpretationHash": interp,
            "mappedPromptHash": mapped,
            "publicLandingHash": landing_hash,
            "sceneAssetId": scene_asset_id,
            "sceneImageUrl": scene_url,
        },
    )
    payload.setdefault("journeyVersion", version)
    payload.setdefault("sourceConversationId", conv)
    payload.setdefault("windowHash", lineage["windowHash"])
    payload.setdefault("scopedInputHash", lineage["scopedInputHash"])
    payload.setdefault("selectedStepsHash", lineage["selectedStepsHash"])
    payload.setdefault("interpretationHash", lineage["interpretationHash"])
    payload.setdefault("publicLandingHash", lineage["publicLandingHash"])
    payload.setdefault("mappedPromptHash", lineage["mappedPromptHash"])
    payload.setdefault("generationId", lineage["generationId"])
    payload.setdefault("sceneAssetId", lineage["sceneAssetId"])
    payload.setdefault("journeyGenerationLineage", lineage)
    return payload


def _publish_body(**extra) -> dict[str, Any]:
    asset_id, scene_url = _scene_url()
    payload: dict[str, Any] = {
        "cardTitle": extra.pop("cardTitle", "Phase 521 Journey"),
        "cardDate": "2026-08-14",
        "conversationId": extra.pop("conversationId", "conv-phase521"),
        "sceneImageUrl": extra.pop("sceneImageUrl", scene_url),
        "sceneAssetId": extra.pop("sceneAssetId", asset_id),
        "curiosityBundle": extra.pop("curiosityBundle", dict(JAPAN_FIXTURE_BUNDLE)),
        "intelligencePrivate": extra.pop(
            "intelligencePrivate",
            {
                "intelligenceBrief": {
                    "mirrorLineage": {
                        "generationId": extra.get("generationId") or "gen-phase521",
                        "generationAcceptedAt": 1_700_000_000_000,
                    }
                },
                "relationshipMap": {"islands": ["MUST_NOT_LEAK"]},
            },
        ),
        "safetyLevel": "normal",
        **extra,
    }
    if payload.get("journeyId"):
        if "selectedSteps" not in payload:
            payload["selectedSteps"] = _live_steps(tag=ALICE_REPLAY_TAG)
        payload.setdefault("windowIndex", 0)
        payload.setdefault("windowStart", 0)
        payload.setdefault("windowEnd", 7)
        payload = _attach_generation_lineage(payload)
    return payload


def _json_keys(payload: Any) -> set[str]:
    keys: set[str] = set()

    def _walk(value: Any) -> None:
        if isinstance(value, dict):
            keys.update(value.keys())
            for nested in value.values():
                _walk(nested)
        elif isinstance(value, list):
            for item in value:
                _walk(item)

    _walk(payload)
    return keys


class Phase521Harness:
    def __init__(self, client: TestClient, store: NetworkStore, alice, bob):
        self.client = client
        self.store = store
        self.alice = alice
        self.bob = bob

    def publish(self, user, body: dict[str, Any]):
        return self.client.post(
            "/api/mirror-network/publish",
            json=body,
            headers=_auth(user),
        )

    def start_sohbet(self, slug: str, guest_token: str = GUEST_BOB):
        return self.client.post(
            f"/api/mirror-network/{slug}/sohbet/session",
            json={"guestToken": guest_token},
        )

    def children(self, slug: str):
        return self.client.get(f"/api/mirror-network/{slug}/children")

    def frozen(self, slug: str):
        return self.client.get(f"/api/mirror-network/{slug}/frozen")

    def author_published(self, user_id: uuid.UUID):
        return self.client.get(f"/api/mirror-network/authors/{user_id}/published")

    def publish_root_alice(self, slug: str = "yansi-alice-a") -> str:
        steps = _live_steps(tag=ALICE_REPLAY_TAG, eza_score=13)
        body = _publish_body(
            journeyId=slug,
            conversationId="conv-alice-root",
            cardTitle="Alice Root Yansi",
            selectedSteps=steps,
        )
        response = self.publish(self.alice, body)
        assert response.status_code == 201, response.text
        node = self.store.nodes[slug]
        assert node.parent_slug is None
        assert str(node.user_id) == str(self.alice.id)
        return slug

    def continue_and_publish(
        self,
        *,
        origin_slug: str,
        journey_id: str,
        conversation_id: str,
        selected_count: int = 8,
        parent_slug: str | None = None,
        omit_parent: bool = True,
        window_index: int = 0,
        window_start: int = 0,
        window_end: int = 7,
        tag: str = BOB_LIVE_TAG,
        guest_token: str = GUEST_BOB,
        reuse_proof: str | None = None,
        eza_score: int | None = 91,
    ) -> dict[str, Any]:
        if reuse_proof:
            proof_token = reuse_proof
        else:
            session = self.start_sohbet(origin_slug, guest_token)
            assert session.status_code == 201, session.text
            session_body = session.json()
            proof_token = session_body["lineageProofToken"]
            assert proof_token
            proof = self.store.proofs[uuid.UUID(proof_token)]
            assert proof.source_mirror_slug == origin_slug

        steps = _live_steps(
            tag=tag,
            selected_count=selected_count,
            start=window_start,
            eza_score=eza_score,
        )
        assert [s["sourceOrder"] for s in steps] == list(
            range(window_start, window_start + selected_count)
        )
        body = _publish_body(
            journeyId=journey_id,
            conversationId=conversation_id,
            cardTitle=f"Bob Journey {journey_id}",
            selectedSteps=steps,
            windowIndex=window_index,
            windowStart=window_start,
            windowEnd=window_end,
            lineageProofToken=proof_token,
            guestToken=guest_token,
        )
        if omit_parent:
            body.pop("parentSlug", None)
        elif parent_slug is not None:
            body["parentSlug"] = parent_slug
        response = self.publish(self.bob, body)
        return {
            "response": response,
            "proofToken": proof_token,
            "steps": steps,
            "body": body,
        }


def _install_patches(store: NetworkStore) -> ExitStack:
    stack = ExitStack()
    stack.enter_context(
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=True,
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.continuation_proof.MirrorContinuationProof",
            side_effect=lambda **kwargs: SimpleNamespace(
                user_id=None,
                consumed_at=None,
                conversation_id=None,
                **kwargs,
            ),
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.continuation_proof.get_continuation_proof_by_id",
            new=store.get_proof,
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.continuation_proof.atomically_consume_continuation_proof",
            new=store.consume_proof,
        )
    )
    stack.enter_context(
        patch(
            "backend.routers.mirror_network.assert_can_start_discover_conversation",
            new=AsyncMock(
                return_value=SimpleNamespace(user_id=None, guest_fingerprint="fp-521")
            ),
        )
    )
    stack.enter_context(
        patch(
            "backend.routers.mirror_network.record_account_usage_event",
            new=AsyncMock(),
        )
    )

    repo_patches = {
        "get_mirror_network_node_by_slug": store.get_by_slug,
        "get_mirror_network_node_by_slug_for_user": store.get_by_slug_for_user,
        "slug_exists": store.slug_exists,
        "create_mirror_network_node": store.create_node,
        "update_mirror_network_node": store.update_node,
        "get_mirror_network_node_by_conversation": store.get_by_conversation,
        "list_journey_nodes_for_conversation": store.list_journeys,
    }
    for name, impl in repo_patches.items():
        stack.enter_context(
            patch(f"backend.services.mirror_network.repository.{name}", new=impl)
        )
    for module, names in (
        ("backend.services.mirror_network.publish", (
            "get_mirror_network_node_by_slug_for_user",
            "slug_exists",
            "create_mirror_network_node",
            "update_mirror_network_node",
            "get_mirror_network_node_by_conversation",
            "get_mirror_network_node_by_slug",
        )),
        ("backend.services.mirror_network.service", ("get_mirror_network_node_by_slug",)),
        ("backend.services.mirror_network.sohbet_session", ("get_mirror_network_node_by_slug",)),
        ("backend.services.mirror_network.parent_lineage", ("get_mirror_network_node_by_slug",)),
        ("backend.services.mirror_network.same_conversation_parent", (
            "get_mirror_network_node_by_slug",
            "list_journey_nodes_for_conversation",
        )),
        ("backend.services.mirror_network.author_profile", ("get_mirror_network_node_by_slug",)),
    ):
        for name in names:
            stack.enter_context(patch(f"{module}.{name}", new=repo_patches[name]))

    stack.enter_context(
        patch(
            "backend.services.mirror_network.publish.replace_journey_steps_for_version",
            new=store.replace_steps,
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.publish.get_lineage_selected_steps_hash_for_version",
            new=store.lineage_hash,
        )
    )
    stack.enter_context(
        patch(
            "backend.services.mirror_network.frozen_journey_artifact.list_frozen_steps_for_version",
            new=store.list_steps,
        )
    )
    return stack


@pytest.fixture
def harness():
    store = NetworkStore()
    alice = _user(email="alice-phase521@test.eza.ai")
    bob = _user(email="bob-phase521@test.eza.ai")
    store.users[alice.id] = alice
    store.users[bob.id] = bob

    async def _override_db():
        yield store.db

    async def _no_rate_limit():
        return None

    async def _get_user(_db, user_id):
        try:
            uid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
        except (ValueError, TypeError):
            return None
        return store.users.get(uid)

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[rate_limit_standalone] = _no_rate_limit
    try:
        with _install_patches(store):
            with patch(
                "backend.auth.mirror_entitlement.get_production_user_by_id",
                new=_get_user,
            ):
                yield Phase521Harness(TestClient(app), store, alice, bob)
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(rate_limit_standalone, None)


def _assert_durable_child(store: NetworkStore, *, slug: str, author_id, parent_slug: str):
    node = store.nodes[slug]
    assert str(node.user_id) == str(author_id)
    assert node.parent_slug == parent_slug
    assert node.published_at is not None
    assert (node.visibility or "public") == "public"
    assert node.artifact_kind == ARTIFACT_KIND_JOURNEY_V1
    assert node.freeze_status == FREEZE_STATUS_FROZEN


def _assert_frozen_is_bob_selection(
    frozen: dict[str, Any],
    *,
    slug: str,
    bob_id,
    alice_id,
    parent_slug: str,
    selected: list[dict[str, Any]],
):
    assert frozen["slug"] == slug
    assert frozen["replayReady"] is True
    assert frozen["selectedCount"] == len(selected)
    assert frozen["authorUserId"] == str(bob_id)
    assert frozen["authorUserId"] != str(alice_id)
    assert frozen["parentSlug"] == parent_slug
    steps = frozen["steps"]
    assert [s["stepIndex"] for s in steps] == list(range(1, len(selected) + 1))
    assert [s["publicQuestion"] for s in steps] == [s["publicQuestion"] for s in selected]
    assert [s["publicAnswer"] for s in steps] == [s["publicAnswer"] for s in selected]
    blob = json.dumps(frozen)
    assert ALICE_REPLAY_TAG not in blob
    assert "AliceReplay" not in blob
    keys = _json_keys(frozen)
    leaked = PRIVACY_FORBIDDEN_KEYS.intersection(keys)
    assert not leaked, leaked
    assert "userId" not in keys
    for step in steps:
        assert "sourceOrder" not in step
        if step.get("ezaSnapshot"):
            assert "relationshipMap" not in step["ezaSnapshot"]
            assert step["ezaSnapshot"].get("assistantScore") != 13


@pytest.mark.parametrize("selected_count", [6, 7, 8])
def test_phase521_http_loop_alice_to_bob_child(harness: Phase521Harness, selected_count: int):
    slug_a = harness.publish_root_alice()
    frozen_a = harness.frozen(slug_a)
    assert frozen_a.status_code == 200, frozen_a.text
    assert frozen_a.json()["authorUserId"] == str(harness.alice.id)
    assert ALICE_REPLAY_TAG in json.dumps(frozen_a.json())

    slug_b = f"yansi-bob-b{selected_count}"
    result = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id=slug_b,
        conversation_id=f"conv-bob-from-a-{selected_count}",
        selected_count=selected_count,
        omit_parent=True,
    )
    published = result["response"]
    assert published.status_code == 201, published.text
    assert published.json()["slug"] == slug_b

    _assert_durable_child(
        harness.store,
        slug=slug_b,
        author_id=harness.bob.id,
        parent_slug=slug_a,
    )

    children = harness.children(slug_a)
    assert children.status_code == 200, children.text
    child_body = children.json()
    slugs = [item["slug"] for item in child_body["items"]]
    assert slug_b in slugs
    child_item = next(item for item in child_body["items"] if item["slug"] == slug_b)
    assert child_item["parentSlug"] == slug_a

    frozen = harness.frozen(slug_b)
    assert frozen.status_code == 200, frozen.text
    _assert_frozen_is_bob_selection(
        frozen.json(),
        slug=slug_b,
        bob_id=harness.bob.id,
        alice_id=harness.alice.id,
        parent_slug=slug_a,
        selected=result["steps"],
    )

    profile = harness.author_published(harness.bob.id)
    assert profile.status_code == 200, profile.text
    profile_slugs = [item["slug"] for item in profile.json()["items"]]
    assert slug_b in profile_slugs
    alice_profile = harness.author_published(harness.alice.id)
    assert alice_profile.status_code == 200
    alice_slugs = [item["slug"] for item in alice_profile.json()["items"]]
    assert slug_a in alice_slugs
    assert slug_b not in alice_slugs


def test_phase521_five_selected_rejected_by_existing_contract(harness: Phase521Harness):
    slug_a = harness.publish_root_alice("yansi-alice-a-five")
    session = harness.start_sohbet(slug_a)
    assert session.status_code == 201, session.text
    steps = _live_steps(tag=BOB_LIVE_TAG, selected_count=5)
    asset_id, scene_url = _scene_url()
    body = {
        "cardTitle": "Too Few Steps",
        "cardDate": "2026-08-14",
        "conversationId": "conv-bob-five",
        "journeyId": "yansi-bob-five",
        "sceneImageUrl": scene_url,
        "sceneAssetId": asset_id,
        "curiosityBundle": dict(JAPAN_FIXTURE_BUNDLE),
        "selectedSteps": steps,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "lineageProofToken": session.json()["lineageProofToken"],
        "guestToken": GUEST_BOB,
        "safetyLevel": "normal",
    }
    response = harness.publish(harness.bob, body)
    assert response.status_code == 422
    assert "yansi-bob-five" not in harness.store.nodes


def test_phase521_forged_parent_http_rejected(harness: Phase521Harness):
    slug_a = harness.publish_root_alice("yansi-alice-a-forge")
    slug_c = "yansi-unrelated-c"
    root_c = harness.publish(
        harness.alice,
        _publish_body(
            journeyId=slug_c,
            conversationId="conv-alice-unrelated-c",
            cardTitle="Unrelated C",
            selectedSteps=_live_steps(tag="UnrelatedC"),
        ),
    )
    assert root_c.status_code == 201, root_c.text
    assert harness.store.nodes[slug_c].parent_slug is None

    result = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id="yansi-bob-forged",
        conversation_id="conv-bob-forged",
        omit_parent=False,
        parent_slug=slug_c,
    )
    response = result["response"]
    assert response.status_code == 400, response.text
    assert response.json()["detail"]["code"] == "journey_parent_invalid"
    assert "yansi-bob-forged" not in harness.store.nodes
    children_a = harness.children(slug_a).json()
    assert "yansi-bob-forged" not in [item["slug"] for item in children_a["items"]]
    children_c = harness.children(slug_c).json()
    assert "yansi-bob-forged" not in [item["slug"] for item in children_c["items"]]


def test_phase521_omit_parent_does_not_become_root(harness: Phase521Harness):
    slug_a = harness.publish_root_alice("yansi-alice-a-omit")
    result = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id="yansi-bob-omit",
        conversation_id="conv-bob-omit",
        omit_parent=True,
    )
    assert result["response"].status_code == 201, result["response"].text
    node = harness.store.nodes["yansi-bob-omit"]
    assert node.parent_slug == slug_a
    assert node.parent_slug is not None
    frozen = harness.frozen("yansi-bob-omit").json()
    assert frozen["parentSlug"] == slug_a


def test_phase521_deep_lineage_continuation_from_b(harness: Phase521Harness):
    slug_a = harness.publish_root_alice("yansi-alice-a-deep")
    b = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id="yansi-bob-b-deep",
        conversation_id="conv-bob-from-a-deep",
        omit_parent=True,
    )
    assert b["response"].status_code == 201, b["response"].text

    c = harness.continue_and_publish(
        origin_slug="yansi-bob-b-deep",
        journey_id="yansi-bob-c-deep",
        conversation_id="conv-bob-from-b-deep",
        omit_parent=True,
        tag="BobFromB",
        eza_score=77,
    )
    assert c["response"].status_code == 201, c["response"].text
    node_c = harness.store.nodes["yansi-bob-c-deep"]
    assert node_c.parent_slug == "yansi-bob-b-deep"
    assert node_c.parent_slug != slug_a

    children_b = harness.children("yansi-bob-b-deep").json()
    assert "yansi-bob-c-deep" in [item["slug"] for item in children_b["items"]]

    children_a = harness.children(slug_a).json()
    a_slugs = [item["slug"] for item in children_a["items"]]
    assert "yansi-bob-b-deep" in a_slugs
    assert "yansi-bob-c-deep" not in a_slugs

    frozen_c = harness.frozen("yansi-bob-c-deep")
    assert frozen_c.status_code == 200
    blob = json.dumps(frozen_c.json())
    assert "BobFromB" in blob
    assert ALICE_REPLAY_TAG not in blob
    assert BOB_LIVE_TAG not in blob


def test_phase521_same_conversation_block1_parent_is_b(harness: Phase521Harness):
    slug_a = harness.publish_root_alice("yansi-alice-a-block")
    b = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id="yansi-bob-b-block",
        conversation_id="conv-bob-same-block",
        omit_parent=True,
    )
    assert b["response"].status_code == 201, b["response"].text
    proof = b["proofToken"]

    c = harness.continue_and_publish(
        origin_slug=slug_a,
        journey_id="yansi-bob-c-block",
        conversation_id="conv-bob-same-block",
        omit_parent=True,
        window_index=1,
        window_start=8,
        window_end=15,
        tag="BobBlock1",
        reuse_proof=proof,
        eza_score=None,
    )
    assert c["response"].status_code == 201, c["response"].text
    node_c = harness.store.nodes["yansi-bob-c-block"]
    assert node_c.parent_slug == "yansi-bob-b-block"
    assert node_c.parent_slug != slug_a
    children_b = harness.children("yansi-bob-b-block").json()
    assert "yansi-bob-c-block" in [item["slug"] for item in children_b["items"]]
    children_a = harness.children(slug_a).json()
    assert "yansi-bob-c-block" not in [item["slug"] for item in children_a["items"]]


def test_phase521_legacy_root_chat_does_not_require_parent(harness: Phase521Harness):
    slug = "yansi-legacy-root"
    response = harness.publish(
        harness.alice,
        _publish_body(
            journeyId=slug,
            conversationId="conv-legacy-no-origin",
            cardTitle="Legacy Root",
            selectedSteps=_live_steps(tag="LegacyRoot"),
        ),
    )
    assert response.status_code == 201, response.text
    node = harness.store.nodes[slug]
    assert node.parent_slug is None
    frozen = harness.frozen(slug)
    assert frozen.status_code == 200
    assert frozen.json()["parentSlug"] is None
    assert frozen.json()["authorUserId"] == str(harness.alice.id)
