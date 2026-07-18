# -*- coding: utf-8 -*-
"""Mirror Meaning Analysis service (PR A / A.1) — isolated, not wired to production routes.

Does NOT consume visual quota. Callers may inject an HTTP completer for tests.

Exception policy:
- Typed provider/parse failures → MirrorMeaningAnalysisFailure (safe fallback signal)
- Programming errors (AttributeError, TypeError, KeyError, …) are NOT swallowed
  into silent fallback; they propagate (or raise in CI after structured log).
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Awaitable, Callable, Optional

import httpx
from pydantic import ValidationError

from backend.config import get_settings
from backend.core.openai.config import build_openai_request_headers
from backend.core.schemas.mirror_director import (
    MIRROR_DIRECTOR_SCHEMA_VERSION,
    MirrorMeaningAnalysis,
    MirrorMeaningAnalysisFailure,
    MirrorMeaningAnalysisResult,
    MirrorMeaningAnalysisSuccess,
    normalize_mirror_director_topic,
)
from backend.services.mirror.conversation_snapshot import (
    MirrorConversationSnapshot,
    snapshot_to_model_input,
)

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_TIMEOUT_SECONDS = 25.0
DEFAULT_MODEL = "gpt-4o-mini"
LOW_CONFIDENCE_THRESHOLD = 0.60

ChatCompleter = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]

_SYSTEM_PROMPT = """You analyze a conversation to prepare a SAINA Mirror (visual memory cover).
Return ONLY valid JSON matching this schema (no markdown):
{
  "primaryTopic": one of vehicle|travel|architecture|technology_ai|finance|health|food_culture|family|education|spiritual_reflection|general_curiosity|other,
  "topicCategory": same controlled enum as primaryTopic (normalized),
  "secondaryTopics": string[],
  "userIntent": string,
  "emotionalTone": string[],
  "narrative": string,
  "visualMotifs": string[],
  "forbiddenSymbols": string[],
  "suggestedPalette": string[],
  "suggestedComposition": string,
  "confidence": number 0..1
}
Rules:
- primaryTopic must be the conversation's main domain, not a secondary detail.
- Walk/yürüyüş alone is NOT health unless fitness/calories/steps are the goal.
- Travel place names (Kyoto, Rome, Gion…) imply travel.
- Sidewalk/walkway design implies architecture.
- forbiddenSymbols must block off-topic imagery (bathroom, cosmetics, medical, gym) when irrelevant.
- Do not invent the user's face, identity, or sensitive personal traits.
- Do not include raw user IDs or private metadata.
"""


def _failure(
    code: str,
    message: str,
    *,
    retryable: bool = False,
) -> MirrorMeaningAnalysisFailure:
    return MirrorMeaningAnalysisFailure(ok=False, code=code, message=message, retryable=retryable)  # type: ignore[arg-type]


def _is_ci_or_test() -> bool:
    env = (os.getenv("EZA_ENV") or os.getenv("ENV") or "").strip().lower()
    return env in {"ci", "test"} or bool(os.getenv("PYTEST_CURRENT_TEST"))


def re_strip_fence(text: str) -> str:
    lines = text.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extract_json_object(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty model content")
    if text.startswith("```"):
        text = re_strip_fence(text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("model JSON root is not an object")
    return data


def parse_meaning_analysis_payload(data: dict[str, Any]) -> MirrorMeaningAnalysis:
    """Validate + normalize a model JSON object into MirrorMeaningAnalysis."""
    primary = normalize_mirror_director_topic(data.get("primaryTopic") or data.get("topicCategory"))
    category = normalize_mirror_director_topic(data.get("topicCategory") or primary)
    if primary != "other":
        category = primary
    allowed = {
        "schemaVersion",
        "primaryTopic",
        "topicCategory",
        "secondaryTopics",
        "userIntent",
        "emotionalTone",
        "narrative",
        "visualMotifs",
        "forbiddenSymbols",
        "suggestedPalette",
        "suggestedComposition",
        "confidence",
    }
    cleaned = {k: v for k, v in data.items() if k in allowed}
    payload = {
        **cleaned,
        "schemaVersion": MIRROR_DIRECTOR_SCHEMA_VERSION,
        "primaryTopic": primary,
        "topicCategory": category,
    }
    return MirrorMeaningAnalysis.model_validate(payload)


class MirrorMeaningProviderSignal(Exception):
    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


def _classify_http_error(status_code: int, body_text: str) -> MirrorMeaningProviderSignal:
    lowered = (body_text or "").lower()
    if status_code == 429 and ("insufficient_quota" in lowered or "billing" in lowered):
        return MirrorMeaningProviderSignal(
            "insufficient_quota",
            "provider insufficient quota",
            retryable=False,
        )
    if status_code == 429:
        return MirrorMeaningProviderSignal("rate_limit", "provider rate limited", retryable=True)
    if status_code in (401, 403):
        return MirrorMeaningProviderSignal("auth_config", f"provider auth HTTP {status_code}")
    if status_code >= 500:
        return MirrorMeaningProviderSignal(
            "provider_error",
            f"provider HTTP {status_code}",
            retryable=True,
        )
    return MirrorMeaningProviderSignal("provider_error", f"provider HTTP {status_code}")


async def _default_openai_completer(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise MirrorMeaningProviderSignal("missing_api_key", "OPENAI_API_KEY missing")

    timeout = float(payload.pop("_timeout", DEFAULT_TIMEOUT_SECONDS))
    headers = build_openai_request_headers(api_key)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)
    if response.status_code >= 400:
        # Never log response body (may echo prompt fragments).
        raise _classify_http_error(response.status_code, response.text[:400])
    try:
        data = response.json()
    except ValueError as exc:
        raise MirrorMeaningProviderSignal("invalid_json", "provider returned non-JSON body") from exc
    if not isinstance(data, dict):
        raise MirrorMeaningProviderSignal("empty_response", "provider JSON root invalid")
    return data


async def analyze_mirror_meaning(
    snapshot: MirrorConversationSnapshot,
    *,
    completer: Optional[ChatCompleter] = None,
    model: Optional[str] = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    low_confidence_threshold: float = LOW_CONFIDENCE_THRESHOLD,
) -> MirrorMeaningAnalysisResult:
    """
    Run one structured meaning analysis call.

    Visual quota is never touched here. On typed failure, callers should use
    the heuristic fallback (frontend semantic-first).
    """
    if not snapshot.messages:
        return _failure("empty_snapshot", "snapshot has no messages")

    settings = get_settings()
    use_model = (model or getattr(settings, "EZA_MIRROR_MEANING_MODEL", None) or DEFAULT_MODEL).strip()
    completer_fn = completer or _default_openai_completer

    user_payload = snapshot_to_model_input(snapshot)
    request_body: dict[str, Any] = {
        "model": use_model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False),
            },
        ],
        "_timeout": timeout_seconds,
    }

    started = time.perf_counter()
    try:
        raw_response = await completer_fn(request_body)
    except MirrorMeaningProviderSignal as exc:
        logger.info("mirror_meaning_analysis_failed code=%s", exc.code)
        return _failure(exc.code, exc.message, retryable=exc.retryable)
    except httpx.TimeoutException:
        logger.info("mirror_meaning_analysis_failed code=timeout")
        return _failure("timeout", "analysis timed out", retryable=True)
    except httpx.HTTPError:
        logger.info("mirror_meaning_analysis_failed code=provider_error")
        return _failure("provider_error", "provider HTTP error", retryable=True)
    # Do not catch Exception here — programming bugs must surface.

    latency_ms = int((time.perf_counter() - started) * 1000)

    try:
        content = _content_from_chat_response(raw_response)
        if not content.strip():
            return _failure("empty_response", "model returned empty content")
        data = _extract_json_object(content)
        analysis = parse_meaning_analysis_payload(data)
    except json.JSONDecodeError:
        return _failure("invalid_json", "model returned invalid JSON")
    except ValidationError:
        return _failure("schema_validation", "model JSON failed schema validation")
    except ValueError:
        return _failure("invalid_json", "model content could not be parsed as JSON object")
    except (KeyError, TypeError, AttributeError) as exc:
        # Malformed provider envelope — typed empty/invalid, not a silent swallow of logic bugs
        # in our own code paths beyond content extraction.
        logger.warning(
            "mirror_meaning_analysis_envelope_error type=%s",
            type(exc).__name__,
        )
        if _is_ci_or_test():
            raise
        return _failure("empty_response", "provider response envelope invalid")

    below = analysis.confidence < low_confidence_threshold
    return MirrorMeaningAnalysisSuccess(
        ok=True,
        analysis=analysis,
        model=use_model,
        latencyMs=latency_ms,
        belowConfidenceThreshold=below,
    )


def _content_from_chat_response(raw: dict[str, Any]) -> str:
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("missing choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        raise ValueError("missing message")
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("missing content")
    return content
