# -*- coding: utf-8 -*-
"""Production prepare-director-draft pipeline (PR C).

Order: resolve mode/policy → (optional) snapshot → meaning → orchestrator → V5 map.
Does NOT consume visual quota or generate images.

Output authority is controlled solely by MirrorDirectorExecutionPolicy.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Awaitable, Callable, Optional

from backend.core.schemas.mirror_director import MirrorMeaningAnalysis
from backend.core.schemas.mirror_prepare_director import (
    MirrorConversationMessageDTO,
    MirrorPrepareDirectorDraftResponse,
)
from backend.services.mirror.conversation_snapshot import build_mirror_conversation_snapshot
from backend.services.mirror.mirror_content_hash import build_mirror_director_content_hash
from backend.services.mirror.mirror_director_mode import get_mirror_director_execution_policy
from backend.services.mirror.mirror_director_orchestrator import run_mirror_director_orchestration
from backend.services.mirror.mirror_director_prepare_cache import cache_get, cache_set
from backend.services.mirror.mirror_director_telemetry import emit_director_event
from backend.services.mirror.mirror_draft_to_v5 import map_mirror_draft_to_v5_prompt
from backend.services.mirror.mirror_meaning_analysis import (
    ChatCompleter,
    analyze_mirror_meaning,
)
from backend.services.mirror.mirror_meaning_heuristic import build_heuristic_meaning_from_snapshot

logger = logging.getLogger(__name__)

MEANING_TIMEOUT_S = 12.0


def _dto_to_snapshot(
    messages: list[MirrorConversationMessageDTO],
    *,
    title: str | None,
    conversation_summary: str | None,
):
    ordered = sorted(
        messages,
        key=lambda m: (m.sequence is None, m.sequence if m.sequence is not None else 0),
    )
    users = [m.text for m in ordered if m.role == "user"]
    assistants = [m.text for m in ordered if m.role == "assistant"]
    return build_mirror_conversation_snapshot(
        title=title,
        user_messages=users,
        assistant_messages=assistants[:2] if assistants else None,
        conversation_summary=conversation_summary,
        include_assistant=bool(assistants),
    )


def _legacy_response(*, message: str = "director_legacy") -> MirrorPrepareDirectorDraftResponse:
    return MirrorPrepareDirectorDraftResponse(
        directorEnabled=False,
        usedDirector=False,
        directorMode="LEGACY",
        directorExecuted=False,
        directorAffectedOutput=False,
        applyTitle=False,
        applyPrompt=False,
        titleSource="legacy_heuristic",
        promptSource="legacy_heuristic",
        message=message,
    )


async def prepare_mirror_director_draft(
    *,
    conversation_id: str,
    generation_request_id: str,
    messages: list[MirrorConversationMessageDTO],
    title: str | None = None,
    conversation_summary: str | None = None,
    scope_key: str | None = None,
    meaning_completer: Optional[ChatCompleter] = None,
    draft_completer: Optional[Callable[..., Awaitable[Any]]] = None,
    review_completer: Optional[Callable[..., Awaitable[Any]]] = None,
) -> MirrorPrepareDirectorDraftResponse:
    policy = get_mirror_director_execution_policy()

    if not policy.run_director_pipeline:
        emit_director_event(
            "director_skipped_legacy",
            conversationId=conversation_id[:48],
            generationRequestId=generation_request_id[:48],
            directorMode=policy.mode,
        )
        return _legacy_response()

    snapshot = _dto_to_snapshot(
        messages, title=title, conversation_summary=conversation_summary
    )
    content_hash = build_mirror_director_content_hash(snapshot)

    cached = cache_get(
        generation_request_id,
        director_mode=policy.mode,
        content_hash=content_hash,
        scope_key=scope_key,
    )
    if cached:
        emit_director_event(
            "director_cache_hit",
            generationRequestId=generation_request_id[:48],
            contentHash=content_hash,
            directorMode=policy.mode,
        )
        return MirrorPrepareDirectorDraftResponse.model_validate({**cached, "reusedCache": True})

    emit_director_event(
        "director_started",
        conversationId=conversation_id[:48],
        generationRequestId=generation_request_id[:48],
        directorMode=policy.mode,
    )

    analysis_source = "llm"
    analysis: MirrorMeaningAnalysis
    meaning_ms = 0

    if policy.run_meaning_analysis:
        meaning_started = time.perf_counter()
        meaning_result = await analyze_mirror_meaning(
            snapshot,
            completer=meaning_completer,
            timeout_seconds=MEANING_TIMEOUT_S,
        )
        meaning_ms = int((time.perf_counter() - meaning_started) * 1000)

        if meaning_result.ok and not meaning_result.belowConfidenceThreshold:
            analysis = meaning_result.analysis
        elif meaning_result.ok and meaning_result.belowConfidenceThreshold:
            heuristic = build_heuristic_meaning_from_snapshot(snapshot)
            if (
                heuristic.confidence >= 0.62
                and heuristic.primaryTopic != meaning_result.analysis.primaryTopic
            ):
                analysis = heuristic
                analysis_source = "heuristic_low_llm_confidence"
                emit_director_event(
                    "meaning_fallback",
                    reason="low_confidence_conflict",
                    meaningMs=meaning_ms,
                    directorMode=policy.mode,
                )
            else:
                analysis = meaning_result.analysis
                analysis_source = "llm_low_confidence"
        else:
            analysis = build_heuristic_meaning_from_snapshot(snapshot)
            analysis_source = f"heuristic_{meaning_result.code}"
            emit_director_event(
                "meaning_fallback",
                reason=meaning_result.code,
                meaningMs=meaning_ms,
                directorMode=policy.mode,
            )
    else:
        analysis = build_heuristic_meaning_from_snapshot(snapshot)
        analysis_source = "heuristic_policy_skip"

    def _fallback_response(*, reason: str) -> MirrorPrepareDirectorDraftResponse:
        return MirrorPrepareDirectorDraftResponse(
            directorEnabled=True,
            usedDirector=False,
            directorMode=policy.mode,
            directorExecuted=False,
            directorAffectedOutput=False,
            applyTitle=False,
            applyPrompt=False,
            titleSource="legacy_heuristic",
            promptSource="legacy_heuristic",
            fallbackReason=reason,
            contentHash=content_hash,
            message="director_failed_use_legacy",
        )

    try:
        # force=True: mode already resolved; orchestrator must not re-check boolean alone
        orch = await run_mirror_director_orchestration(
            snapshot=snapshot,
            analysis=analysis,
            draft_completer=draft_completer if policy.run_draft else None,
            review_completer=review_completer if policy.run_review else None,
            force=True,
            analysis_source=analysis_source,
        )

        title_source_internal = orch.draftSource
        if orch.draftSource in {"llm_draft_approved", "llm_draft_revised"}:
            art_source = "llm_draft"
        elif orch.draftSource == "heuristic_draft":
            art_source = "heuristic_draft"
            title_source_internal = "heuristic_draft"
        else:
            art_source = "safe_fallback"
            title_source_internal = "safe_fallback"

        mapped = map_mirror_draft_to_v5_prompt(
            orch.finalDraft,
            title_source=title_source_internal,
            art_direction_source=art_source,
        )

        meta = orch.metadata.model_copy(
            update={
                "analysisSource": analysis_source,
                "contentHash": content_hash,
            }
        )

        apply_title = bool(policy.use_director_title and policy.affect_user_output)
        apply_prompt = bool(policy.use_director_prompt and policy.affect_user_output)

        if apply_title:
            user_title_source = title_source_internal
        else:
            user_title_source = "legacy_heuristic"

        if apply_prompt:
            user_prompt_source = "director_v5_mapper"
        else:
            user_prompt_source = "legacy_heuristic"

        response = MirrorPrepareDirectorDraftResponse(
            directorEnabled=True,
            usedDirector=True,
            reusedCache=False,
            directorMode=policy.mode,
            directorExecuted=True,
            directorAffectedOutput=policy.affect_user_output,
            applyTitle=apply_title,
            applyPrompt=apply_prompt,
            mappedPrompt=mapped if (apply_title or apply_prompt) else None,
            shadowMappedPrompt=mapped if policy.mode == "SHADOW" else None,
            finalDraft=orch.finalDraft if policy.persist_director_metadata else None,
            metadata=meta if policy.persist_director_metadata else None,
            fallbackReason=orch.fallbackReason,
            contentHash=content_hash,
            titleSource=user_title_source,
            promptSource=user_prompt_source,
        )
    except Exception as exc:
        # Provider/transient failures and coding bugs both keep legacy UX.
        # Coding bugs must be visible in logs + telemetry (no silent swallow).
        coding_bug = isinstance(
            exc,
            (TypeError, AttributeError, KeyError, AssertionError, NameError, IndexError),
        )
        logger.exception(
            "director_orchestrator_%s",
            "coding_bug" if coding_bug else "unexpected",
        )
        emit_director_event(
            "director_coding_bug" if coding_bug else "director_total_fallback",
            reason="coding_bug" if coding_bug else "orchestrator_exception",
            errorType=type(exc).__name__,
            errorMessage=str(exc)[:160],
            directorMode=policy.mode,
            contentHash=content_hash,
            generationRequestId=generation_request_id[:48],
        )
        return _fallback_response(
            reason="coding_bug" if coding_bug else "orchestrator_exception"
        )

    emit_director_event(
        "director_completed",
        generationRequestId=generation_request_id[:48],
        contentHash=content_hash,
        draftSource=orch.draftSource,
        directorDecision=orch.directorDecision,
        revisionCount=orch.revisionCount,
        draftMs=orch.draftDurationMs,
        reviewMs=orch.reviewDurationMs,
        totalMs=orch.totalDurationMs,
        meaningMs=meaning_ms,
        directorMode=policy.mode,
        directorAffectedOutput=policy.affect_user_output,
        applyTitle=response.applyTitle,
        applyPrompt=response.applyPrompt,
    )
    if orch.directorDecision == "approve":
        emit_director_event("review_approve", contentHash=content_hash, directorMode=policy.mode)
    elif orch.directorDecision == "revise":
        emit_director_event(
            "review_revise", contentHash=content_hash, revisionCount=1, directorMode=policy.mode
        )

    cache_set(
        generation_request_id,
        response.model_dump(),
        director_mode=policy.mode,
        content_hash=content_hash,
        scope_key=scope_key,
    )
    return response
