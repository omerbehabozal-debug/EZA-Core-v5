# -*- coding: utf-8 -*-
"""Production prepare-director-draft pipeline (PR C + D1 + D2).

Order (D2 default for SHADOW/SOFT/FULL):
  resolve mode → D1 conversation context → Interpretation V1 → V5 map → cache

Legacy (LEGACY mode, or EZA_MIRROR_INTERPRETATION_V1=false):
  snapshot → Meaning → Draft → Review → V5 map

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
from backend.core.schemas.mirror_conversation_context import MirrorConversationContextV1
from backend.services.mirror.conversation_snapshot import build_mirror_conversation_snapshot
from backend.services.mirror.mirror_content_hash import build_mirror_director_content_hash
from backend.services.mirror.mirror_conversation_context import (
    build_mirror_conversation_context_v1,
    select_assistant_texts_for_snapshot,
)
from backend.services.mirror.mirror_director_mode import get_mirror_director_execution_policy
from backend.services.mirror.mirror_director_orchestrator import run_mirror_director_orchestration
from backend.services.mirror.mirror_director_prepare_cache import (
    build_prepare_cache_contract_fingerprint,
    cache_get,
    cache_set,
    describe_prepare_cache_contract,
)
from backend.services.mirror.mirror_director_telemetry import emit_director_event
from backend.services.mirror.mirror_draft_to_v5 import map_mirror_draft_to_v5_prompt
from backend.services.mirror.mirror_interpretation import (
    build_heuristic_interpretation,
    generate_mirror_interpretation,
)
from backend.services.mirror.mirror_interpretation_to_v5 import (
    interpretation_hash,
    map_interpretation_to_v5_prompt,
)
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
    # PR D1: keep first + latest assistants (not earliest-only [:2]).
    assistant_snippets = select_assistant_texts_for_snapshot(assistants)
    return build_mirror_conversation_snapshot(
        title=title,
        user_messages=users,
        assistant_messages=assistant_snippets if assistant_snippets else None,
        conversation_summary=conversation_summary,
        include_assistant=bool(assistant_snippets),
    )


def _legacy_response(
    *,
    message: str = "director_legacy",
    conversation_context: MirrorConversationContextV1 | None = None,
) -> MirrorPrepareDirectorDraftResponse:
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
        conversationContext=conversation_context,
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
    interpretation_completer: Optional[ChatCompleter] = None,
) -> MirrorPrepareDirectorDraftResponse:
    policy = get_mirror_director_execution_policy()

    # PR D1 — evidence package (non-authoritative for creative output).
    conversation_context = build_mirror_conversation_context_v1(
        messages,
        conversation_id=conversation_id,
        locale="tr",
    )
    emit_director_event(
        "conversation_context_built",
        conversationId=conversation_id[:48],
        generationRequestId=generation_request_id[:48],
        directorMode=policy.mode,
        sourceMessageCount=conversation_context.diagnostics.sourceMessageCount,
        selectedMessageCount=conversation_context.diagnostics.selectedMessageCount,
        omittedMessageCount=conversation_context.diagnostics.omittedMessageCount,
        charEstimate=conversation_context.diagnostics.charEstimate,
        truncationReason=conversation_context.diagnostics.truncationReason,
        correctionCount=conversation_context.diagnostics.correctionCount,
        preferenceCount=conversation_context.diagnostics.preferenceCount,
        unresolvedQuestionCount=conversation_context.diagnostics.unresolvedQuestionCount,
        contextVersion=conversation_context.diagnostics.contextVersion,
    )

    if not policy.run_director_pipeline:
        emit_director_event(
            "director_skipped_legacy",
            conversationId=conversation_id[:48],
            generationRequestId=generation_request_id[:48],
            directorMode=policy.mode,
        )
        return _legacy_response(conversation_context=conversation_context)

    snapshot = _dto_to_snapshot(
        messages, title=title, conversation_summary=conversation_summary
    )
    content_hash = build_mirror_director_content_hash(snapshot)
    contract_fingerprint = build_prepare_cache_contract_fingerprint(
        use_interpretation_v1=policy.use_interpretation_v1,
    )
    contract_meta = describe_prepare_cache_contract(contract_fingerprint)

    cached = cache_get(
        generation_request_id,
        director_mode=policy.mode,
        content_hash=content_hash,
        scope_key=scope_key,
        contract_fingerprint=contract_fingerprint,
    )
    if cached:
        emit_director_event(
            "director_cache_hit",
            generationRequestId=generation_request_id[:48],
            contentHash=content_hash,
            directorMode=policy.mode,
            authorityPath=contract_meta.get("authorityPath"),
            useInterpretationV1=policy.use_interpretation_v1,
            contractFingerprint=contract_fingerprint[:120],
            interpretationVersion=contract_meta.get("interpretationVersion"),
            mapperVersion=contract_meta.get("mapperVersion"),
        )
        return MirrorPrepareDirectorDraftResponse.model_validate({**cached, "reusedCache": True})

    emit_director_event(
        "director_cache_miss",
        generationRequestId=generation_request_id[:48],
        contentHash=content_hash,
        directorMode=policy.mode,
        authorityPath=contract_meta.get("authorityPath"),
        useInterpretationV1=policy.use_interpretation_v1,
        contractFingerprint=contract_fingerprint[:120],
    )

    emit_director_event(
        "director_started",
        conversationId=conversation_id[:48],
        generationRequestId=generation_request_id[:48],
        directorMode=policy.mode,
        useInterpretationV1=policy.use_interpretation_v1,
        authorityPath=contract_meta.get("authorityPath"),
        contractFingerprint=contract_fingerprint[:120],
    )

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
            conversationContext=conversation_context,
        )

    apply_title = bool(policy.use_director_title and policy.affect_user_output)
    apply_prompt = bool(policy.use_director_prompt and policy.affect_user_output)

    # ── PR D2: Interpretation is creative authority ─────────────────────────
    if policy.use_interpretation_v1:
        try:
            interp_result = await generate_mirror_interpretation(
                conversation_context,
                completer=interpretation_completer,
            )
            if interp_result.ok:
                interpretation = interp_result.interpretation
                source = interp_result.source
                latency_ms = interp_result.latency_ms
            else:
                interpretation = build_heuristic_interpretation(conversation_context)
                source = "interpretation_heuristic"
                latency_ms = 0
                emit_director_event(
                    "interpretation_fallback",
                    reason=interp_result.code,
                    directorMode=policy.mode,
                )

            mapped = map_interpretation_to_v5_prompt(
                interpretation,
                title_source=source,
                art_direction_source="interpretation_v1",
            )
            ihash = interpretation_hash(interpretation)
            user_title_source = source if apply_title else "legacy_heuristic"
            user_prompt_source = (
                "interpretation_v5_mapper" if apply_prompt else "legacy_heuristic"
            )

            from backend.core.schemas.mirror_director import normalize_mirror_director_topic
            from backend.core.schemas.mirror_draft import MirrorDirectorMetadataContract
            from backend.core.schemas.mirror_interpretation import (
                MIRROR_INTERPRETATION_SCHEMA_VERSION,
            )

            meta_source: str = (
                "interpretation_llm"
                if source == "interpretation_llm"
                else "interpretation_heuristic"
            )
            meta = MirrorDirectorMetadataContract(
                analysisSchemaVersion=MIRROR_INTERPRETATION_SCHEMA_VERSION,
                draftSchemaVersion=MIRROR_INTERPRETATION_SCHEMA_VERSION,
                analysisSource="interpretation_v1",
                draftSource=meta_source,  # type: ignore[arg-type]
                analysisConfidence=None,
                draftConfidence=interpretation.confidence,
                directorConfidence=interpretation.confidence,
                directorDecision=None,
                directorReasonCodes=[],
                revisionCount=0,
                fallbackReason=None,
                topicCategory=normalize_mirror_director_topic(interpretation.topicCategory),
                draftDurationMs=latency_ms,
                reviewDurationMs=0,
                totalDirectorDurationMs=latency_ms,
                contentHash=content_hash,
            )

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
                finalDraft=None,
                finalInterpretation=interpretation if policy.persist_director_metadata else None,
                metadata=meta if policy.persist_director_metadata else None,
                contentHash=content_hash,
                titleSource=user_title_source,
                promptSource=user_prompt_source,
                conversationContext=conversation_context,
            )
            emit_director_event(
                "interpretation_completed",
                generationRequestId=generation_request_id[:48],
                contentHash=content_hash,
                interpretationSource=source,
                interpretationHash=ihash,
                confidence=interpretation.confidence,
                latencyMs=latency_ms,
                evidenceCoverage=conversation_context.sourceCoverage,
                rolloutArm=policy.mode,
                directorMode=policy.mode,
                applyTitle=apply_title,
                applyPrompt=apply_prompt,
                interpretationVersion=interpretation.version,
            )
            cache_set(
                generation_request_id,
                response.model_dump(),
                director_mode=policy.mode,
                content_hash=content_hash,
                scope_key=scope_key,
                contract_fingerprint=contract_fingerprint,
            )
            return response
        except Exception as exc:
            coding_bug = isinstance(
                exc,
                (TypeError, AttributeError, KeyError, AssertionError, NameError, IndexError),
            )
            logger.exception(
                "interpretation_%s",
                "coding_bug" if coding_bug else "unexpected",
            )
            emit_director_event(
                "director_coding_bug" if coding_bug else "director_total_fallback",
                reason="interpretation_exception",
                errorType=type(exc).__name__,
                errorMessage=str(exc)[:160],
                directorMode=policy.mode,
                contentHash=content_hash,
            )
            return _fallback_response(
                reason="coding_bug" if coding_bug else "interpretation_exception"
            )

    # ── Legacy Meaning → Draft → Review (kill-switch / pre-D2 path) ─────────
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

    try:
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

        user_title_source = title_source_internal if apply_title else "legacy_heuristic"
        user_prompt_source = "director_v5_mapper" if apply_prompt else "legacy_heuristic"

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
            conversationContext=conversation_context,
        )
    except Exception as exc:
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
        contract_fingerprint=contract_fingerprint,
    )
    return response
