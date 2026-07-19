# -*- coding: utf-8 -*-
"""Mirror Director orchestrator (PR B).

Flow:
  Meaning Analysis (provided) → Draft → Director Review → approve | revise-once → Final Draft

Does NOT:
- call image generation
- consume visual quota
- persist metadata
- run on production create-path unless EZA_MIRROR_DIRECTOR_ENABLED (or force=True for tests)

Title authority (for PR C wiring):
- When draftSource is llm_draft_approved or llm_draft_revised, finalDraft.title is
  the title authority — heuristic title pools must NOT override it in the same request.
- Heuristic title pools apply only for heuristic_draft / safe_fallback sources.

Max model calls inside this orchestrator: 2 (draft + review). Meaning is an input.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from backend.core.schemas.mirror_director import MirrorMeaningAnalysis
from backend.core.schemas.mirror_draft import (
    DirectorDecision,
    DirectorReasonCode,
    DraftSource,
    MirrorDirectorMetadataContract,
    MirrorDirectorOrchestratorResult,
    MirrorDraft,
)
from backend.services.mirror.conversation_snapshot import MirrorConversationSnapshot
from backend.services.mirror.mirror_content_hash import build_mirror_director_content_hash
from backend.services.mirror.mirror_director_feature import is_mirror_director_pipeline_enabled
from backend.services.mirror.mirror_draft_generation import (
    ChatCompleter,
    generate_mirror_draft,
)
from backend.services.mirror.mirror_draft_heuristic import (
    build_heuristic_mirror_draft,
    build_minimal_safe_draft,
)
from backend.services.mirror.mirror_draft_precheck import run_draft_prechecks
from backend.services.mirror.mirror_director_review import review_mirror_draft

logger = logging.getLogger(__name__)


class MirrorDirectorDisabledError(RuntimeError):
    """Raised when orchestrator is invoked without enable flag and force=False."""


def _heuristic_or_safe(analysis: MirrorMeaningAnalysis, *, draft_fail_code: str) -> tuple[MirrorDraft, DraftSource, str]:
    try:
        candidate = build_heuristic_mirror_draft(analysis)
        pre = run_draft_prechecks(candidate)
        if pre.ok and pre.normalized_draft is not None:
            return pre.normalized_draft, "heuristic_draft", f"draft_{draft_fail_code}"
    except (TypeError, AttributeError, ValueError):
        logger.exception("heuristic_draft_builder_error")
    safe = build_minimal_safe_draft(topic=analysis.primaryTopic)
    return safe, "safe_fallback", f"draft_{draft_fail_code}+safe"


async def run_mirror_director_orchestration(
    *,
    snapshot: MirrorConversationSnapshot,
    analysis: MirrorMeaningAnalysis,
    draft_completer: Optional[ChatCompleter] = None,
    review_completer: Optional[ChatCompleter] = None,
    force: bool = False,
    analysis_source: str = "provided",
) -> MirrorDirectorOrchestratorResult:
    if not force and not is_mirror_director_pipeline_enabled():
        raise MirrorDirectorDisabledError(
            "Mirror Director pipeline disabled (EZA_MIRROR_DIRECTOR_ENABLED)"
        )

    started = time.perf_counter()
    content_hash = build_mirror_director_content_hash(snapshot)

    draft_ms = 0
    review_ms = 0
    revision_count: int = 0
    decision: DirectorDecision | None = None
    reason_codes: list[DirectorReasonCode] = []
    fallback_reason: str | None = None
    draft_model: str | None = None
    review_model: str | None = None
    director_confidence: float | None = None
    source: DraftSource
    final: MirrorDraft

    draft_result = await generate_mirror_draft(
        snapshot=snapshot,
        analysis=analysis,
        completer=draft_completer,
    )

    if draft_result.ok:
        draft_ms = draft_result.latency_ms
        draft_model = draft_result.model
        first_valid = draft_result.draft

        review_result = await review_mirror_draft(
            snapshot=snapshot,
            analysis=analysis,
            draft=first_valid,
            completer=review_completer,
        )

        if review_result.ok:
            review_ms = review_result.latency_ms
            review_model = review_result.model
            review = review_result.review
            decision = review.decision
            reason_codes = list(review.reasonCodes)
            director_confidence = review.confidence

            if review.decision == "approve":
                final = first_valid
                source = "llm_draft_approved"
            elif review.revisedDraft is not None:
                revision_count = 1
                final = review.revisedDraft
                source = "llm_draft_revised"
            else:
                final = first_valid
                source = "llm_draft_approved"
                fallback_reason = "revised_draft_invalid_kept_first"
        else:
            final = first_valid
            source = "llm_draft_approved"
            fallback_reason = f"review_{review_result.code}"
    else:
        final, source, fallback_reason = _heuristic_or_safe(analysis, draft_fail_code=draft_result.code)

    # Hard bound: never claim more than one revision
    revision_count = 1 if revision_count == 1 else 0

    total_ms = int((time.perf_counter() - started) * 1000)
    meta = MirrorDirectorMetadataContract(
        analysisSource=analysis_source,
        draftSource=source,
        analysisConfidence=analysis.confidence,
        draftConfidence=final.confidence,
        directorConfidence=director_confidence,
        directorDecision=decision,
        directorReasonCodes=reason_codes,
        revisionCount=revision_count,  # type: ignore[arg-type]
        fallbackReason=fallback_reason,
        topicCategory=final.topicCategory,
        draftDurationMs=draft_ms,
        reviewDurationMs=review_ms,
        totalDirectorDurationMs=total_ms,
        contentHash=content_hash,
        draftModel=draft_model,
        reviewModel=review_model,
    )

    return MirrorDirectorOrchestratorResult(
        finalDraft=final,
        draftSource=source,
        directorDecision=decision,
        directorReasonCodes=reason_codes,
        revisionCount=revision_count,  # type: ignore[arg-type]
        fallbackReason=fallback_reason,
        draftDurationMs=draft_ms,
        reviewDurationMs=review_ms,
        totalDurationMs=total_ms,
        contentHash=content_hash,
        metadata=meta,
        internalEvidence=final.evidence,
    )
