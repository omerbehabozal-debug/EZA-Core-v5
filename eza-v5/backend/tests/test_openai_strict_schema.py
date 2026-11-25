"""OpenAI Structured Outputs strict-schema helper tests (no paid calls)."""
from __future__ import annotations

import json

from backend.core.openai.strict_schema import assert_openai_strict_schema, for_openai_strict_schema
from backend.services.yansi import ai_conversation_proposal_v2 as v2ai
from backend.services.business_yansi import studio_generation as generation


def _passages():
    return {
        "a" * 24: {
            "versionId": "x",
            "version": 1,
            "contentHash": "h",
            "start": 0,
            "end": 40,
            "text": "Merhaba bu bir cevap cumlesidir ve yeterince uzundur.",
            "passageHash": "p",
            "offsetEncoding": "unicode-codepoint",
        }
    }


def test_for_openai_strict_requires_all_properties():
    raw = {
        "type": "object",
        "properties": {
            "a": {"type": "string", "default": "x", "title": "A"},
            "b": {"anyOf": [{"type": "string"}, {"type": "null"}], "default": None},
        },
        "required": ["a"],
        "additionalProperties": True,
    }
    fixed = for_openai_strict_schema(raw)
    assert fixed["additionalProperties"] is False
    assert set(fixed["required"]) == {"a", "b"}
    assert "default" not in fixed["properties"]["a"]
    assert "title" not in fixed["properties"]["a"]
    assert "default" not in fixed["properties"]["b"]
    assert assert_openai_strict_schema(fixed) == []


def test_v2_provider_schema_is_openai_strict_compatible():
    schema = v2ai.output_schema(_passages(), None)
    violations = assert_openai_strict_schema(schema)
    assert violations == [], violations
    assert set(schema["required"]) == set(schema["properties"].keys())
    result = schema["$defs"]["ProposalResult"]
    assert set(result["required"]) == set(result["properties"].keys())
    assert "summary" in result["required"]
    assert "rationale" in result["required"]
    assert "default" not in json.dumps(schema)


def test_v2_provider_schema_with_media_keeps_nullable_cover_required():
    media = {"00000000-0000-4000-8000-000000000001": {"coverEligible": True, "kind": "image"}}
    schema = v2ai.output_schema(_passages(), media)
    assert assert_openai_strict_schema(schema) == []
    cover = schema["$defs"]["ProposalResult"]["properties"]["coverAssetId"]
    assert "anyOf" in cover
    assert "coverAssetId" in schema["$defs"]["ProposalResult"]["required"]
    turn = schema["$defs"]["ProposalTurn"]
    assert "mediaSuggestions" in turn["required"]


def test_v1_topics_schema_still_builds():
    # V1 path unchanged by the V2-only transformer application.
    schema = generation.output_schema("topics", _passages())
    assert schema["required"] == ["insufficientSources", "result"]
    assert schema["additionalProperties"] is False
