"""Anonymous public frozen response and publishing markdown regression coverage."""
from copy import deepcopy
from unittest.mock import AsyncMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.routers import mirror_network as routes
from backend.services.mirror_network import frozen_journey_artifact as frozen
from backend.core.schemas.mirror_draft import sanitize_display_text
from backend.services.mirror.journey_step_sanitization import sanitize_selected_journey_steps

FORBIDDEN = {"ezaSnapshot", "eza_snapshot", "assistantScore", "userScore", "ezaFinal",
             "outputHealth", "inputHealth", "alignmentScore", "redirect", "redirectBenign",
             "intent", "behavioral", "behavioralHistory"}

def assert_no_analysis(value):
    if isinstance(value, dict):
        assert not (set(value) & FORBIDDEN)
        for child in value.values():
            assert_no_analysis(child)
    elif isinstance(value, list):
        for child in value:
            assert_no_analysis(child)

@pytest.mark.parametrize("version", [1, 9])
def test_anonymous_frozen_omits_analysis_and_preserves_internal(monkeypatch, version):
    snapshot = {"assistantScore": 91, "userScore": 77, "ezaFinal": 91,
                "outputHealth": .8, "inputHealth": .7, "alignmentScore": .9,
                "redirect": True, "redirectBenign": False, "intent": "question",
                "behavioral": {"vector": {"eza_final": 91}, "nested": {"intent": "private"}}}
    internal = {"slug": "privacy-test", "journeyId": "privacy-test", "journeyVersion": version,
                "authorUserId": "publisher", "replayReady": True, "selectedCount": 6,
                "integrity": {"frozenEzaSnapshotsHash": "unchanged-hash"},
                "selectedSteps": [{"stepIndex": i, "publicQuestion": f"Q{i}?",
                    "publicAnswer": "# Title\n\n1. One\n2. Two", "ezaSnapshot": deepcopy(snapshot),
                    "extra": {"behavioralHistory": [snapshot]}, **snapshot} for i in range(1, 7)]}
    before = deepcopy(internal)
    loader = AsyncMock(return_value=internal)
    monkeypatch.setattr(frozen, "get_frozen_journey_artifact", loader)
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: object()
    app.dependency_overrides[routes.rate_limit_standalone] = lambda: None
    with TestClient(app) as client:
        response = client.get(f"/api/mirror-network/privacy-test/frozen?journeyVersion={version}")
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert_no_analysis(payload)
    assert payload["journeyVersion"] == version
    assert payload["replayReady"] and payload["selectedCount"] == 6
    assert payload["steps"][0] == {"stepIndex": 1, "publicQuestion": "Q1?",
                                    "publicAnswer": "# Title\n\n1. One\n2. Two"}
    assert internal == before
    assert loader.await_args.kwargs["journey_version"] == version

@pytest.mark.parametrize("newline", ["\n", "\r\n", "\r"])
def test_publishing_preserves_markdown(newline):
    source = "# Heading\n\n**Bold** paragraph.\n\n1. One\n2. Two\n   - Nested\n\n- Bullet\n\nHard break  \nNext line".replace("\n", newline)
    result = sanitize_selected_journey_steps([{"publicQuestion": "Question?", "publicAnswer": source}])
    assert result["status"] == "clean"
    assert result["steps"][0]["publicAnswer"] == source.replace("\r\n", "\n").replace("\r", "\n")
    assert "\n" not in sanitize_display_text(source, max_len=4000)

@pytest.mark.parametrize("sensitive,replacement", [("test@example.com", "[email]"),
    ("+90 555 123 45 67", "[phone]"), ("Bearer abcdefghijklmnopqrstuvwxyz123456", "[secret]")])
def test_publishing_still_redacts(sensitive, replacement):
    source = f"# Contact\n\nPlease omit {sensitive} from public text.\n\n- Safe note"
    result = sanitize_selected_journey_steps([{"publicQuestion": "Question?", "publicAnswer": source}])
    assert result["status"] != "blocked"
    answer = result["steps"][0]["publicAnswer"]
    assert sensitive not in answer and replacement in answer
    assert "\n\n" in answer

def test_filters_and_length_cap_remain():
    source = "# Heading\n\n<script>unsafe</script> https://example.com\n\n" + "Long safe paragraph. " * 220
    result = sanitize_selected_journey_steps([{"publicQuestion": "Question?", "publicAnswer": source}])
    assert result["status"] != "blocked"
    answer = result["steps"][0]["publicAnswer"]
    assert len(answer) <= 4000
    assert "<script>" not in answer and "https://example.com" not in answer
    assert "\n\n" in answer
    blocked = sanitize_selected_journey_steps([{"publicQuestion": "Question?", "publicAnswer": "SECRET_PRIVATE_DATA must stay private."}])
    assert blocked["status"] == "blocked"



def test_whitespace_padding_does_not_bypass_material_loss_guard():
    source = "Safe paragraph." + "\n" * 100
    result = sanitize_selected_journey_steps([{"publicQuestion": "Question?", "publicAnswer": source + "End."}])
    assert result["status"] == "blocked"
