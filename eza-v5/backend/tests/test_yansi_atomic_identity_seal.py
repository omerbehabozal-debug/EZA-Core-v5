"""Public Yansı title/image must come from the same freeze seal."""

from types import SimpleNamespace
from uuid import uuid4

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.frozen_journey_artifact import (
    assemble_frozen_journey_artifact_from_loaded,
    to_public_frozen_journey_artifact,
)

URL_A = "https://cdn.example/kisilik-ve-degisim.png"
URL_B = "https://cdn.example/beynin-gece-calismasi.png"


def _steps(n=6):
    return [
        {
            "stepIndex": i,
            "publicQuestion": f"Q{i}?",
            "publicAnswer": f"A{i}",
        }
        for i in range(1, n + 1)
    ]


def _node(*, title, scene_url, frozen):
    return SimpleNamespace(
        id=uuid4(),
        slug="beynin-gece-calismasi",
        user_id=uuid4(),
        conversation_id="conv-kisilik",
        visibility="public",
        safety_status="open",
        freeze_status="frozen",
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        journey_version=1,
        card_title=title,
        scene_image_url=scene_url,
        parent_slug=None,
        published_at=None,
        frozen_at=None,
        window_index=0,
        window_start=0,
        window_end=5,
        private_payload={
            "intelligenceBrief": {
                "frozenJourneyArtifact": frozen,
            }
        },
        public_payload={"publicTitle": title},
    )


def test_assemble_does_not_mix_sealed_title_with_node_scene():
    frozen = {
        "freezeStatus": "frozen",
        "journeyVersion": 1,
        "sourceConversationId": "conv-beynin",
        "authorUserId": "author-b",
        "generationId": "gen-beynin",
        "sceneAssetId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "sceneImageUrl": URL_B,
        "publicLanding": {
            "publicTitle": "Beynin Gece Çalışması",
            "publicSummary": "Gece zihni",
        },
        "selectedCount": 6,
    }
    node = _node(title="Kişilik ve Değişim", scene_url=URL_A, frozen=frozen)
    assembled = assemble_frozen_journey_artifact_from_loaded(
        node, journey_version=1, steps=_steps()
    )
    assert assembled is not None
    assert assembled["publicTitle"] == "Beynin Gece Çalışması"
    assert assembled["sceneImageUrl"] == URL_B
    assert assembled["sourceConversationId"] == "conv-beynin"
    assert assembled["generationId"] == "gen-beynin"
    public = to_public_frozen_journey_artifact(assembled)
    assert public is not None
    assert public["publicTitle"] == "Beynin Gece Çalışması"
    assert public["sceneImageUrl"] == URL_B
    assert public["sourceConversationId"] == "conv-beynin"
    assert public["generationId"] == "gen-beynin"


def test_assemble_does_not_fallback_to_foreign_node_scene_when_seal_has_no_image():
    frozen = {
        "freezeStatus": "frozen",
        "journeyVersion": 1,
        "sourceConversationId": "conv-beynin",
        "authorUserId": "author-b",
        "generationId": "gen-beynin",
        "sceneAssetId": None,
        "sceneImageUrl": None,
        "publicLanding": {
            "publicTitle": "Beynin Gece Çalışması",
            "publicSummary": "Gece zihni",
        },
        "selectedCount": 6,
    }
    node = _node(title="Kişilik ve Değişim", scene_url=URL_A, frozen=frozen)
    assembled = assemble_frozen_journey_artifact_from_loaded(
        node, journey_version=1, steps=_steps()
    )
    assert assembled is not None
    assert assembled["publicTitle"] == "Beynin Gece Çalışması"
    assert assembled["sceneImageUrl"] in (None, "")
    assert assembled["sceneImageUrl"] != URL_A
    assert assembled["sourceConversationId"] != node.conversation_id
