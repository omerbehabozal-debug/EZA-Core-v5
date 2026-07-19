# -*- coding: utf-8 -*-
"""Build MirrorConversationContextV1 from prepare DTOs (PR D1).

Deterministic, evidence-only. No LLM, no visual prescription.
"""

from __future__ import annotations

import re
from typing import Optional, Sequence

from backend.core.schemas.mirror_conversation_context import (
    MIRROR_CONVERSATION_CONTEXT_VERSION,
    MirrorContextEvidenceRef,
    MirrorContextMessageV1,
    MirrorConversationArcV1,
    MirrorConversationContextDiagnosticsV1,
    MirrorConversationContextV1,
    MirrorSalientDetailV1,
)
from backend.core.schemas.mirror_prepare_director import MirrorConversationMessageDTO

# Bounded package budget (character estimate across selected message texts).
MAX_CONTEXT_MESSAGE_CHARS = 6000
MAX_SELECTED_MESSAGES = 36
MAX_USER_TEXT_CHARS = 600
MAX_ASSISTANT_TEXT_CHARS = 400
HEAD_USER = 4
TAIL_USER = 8
MID_USER_PICK = 4
# Snapshot-facing assistant selection (also used when enriching Director snapshot).
MAX_ASSISTANTS_FOR_SNAPSHOT = 3

_PREFERENCE_RE = re.compile(
    r"\b(istiyorum|isterim|tercih|ilgimi\s+çek|hoşuma|prefer|rather|want\s+to|"
    r"would\s+like|seçmek|seçerim)\b",
    re.I,
)
_CORRECTION_RE = re.compile(
    r"\b(aslında|değil|degil|yanlış|yanlis|instead|rather\s+than|not\s+that|"
    r"hayır|hayir|correction|düzelt|duzelt|vazgeç|vazgec)\b",
    re.I,
)
_REJECT_RE = re.compile(
    r"\b(istemiyorum|istemem|olmasın|olmasin|skip|reject|don't\s+want|"
    r"do\s+not\s+want|vazgeç|vazgec|hayır|hayir)\b",
    re.I,
)
_COMPARISON_RE = re.compile(
    r"\b(mı\s+yoksa|mi\s+yoksa|vs\.?|versus|karşılaştır|karsilastir|"
    r"or\s+rather|hangisi|compared\s+to)\b",
    re.I,
)
_UNCERTAIN_ASSIST_RE = re.compile(
    r"\b(öner|oner|suggest|maybe|might|could|olabilir|tavsiye|"
    r"consider|possibly|perhaps)\b",
    re.I,
)
_QUESTION_RE = re.compile(r"[?？]\s*$")


def _excerpt(text: str, max_len: int = 140) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1].rstrip() + "…"


def _order_messages(
    messages: Sequence[MirrorConversationMessageDTO],
) -> list[tuple[int, MirrorConversationMessageDTO]]:
    indexed = list(enumerate(messages))
    indexed.sort(
        key=lambda pair: (
            pair[1].sequence is None,
            pair[1].sequence if pair[1].sequence is not None else pair[0],
            pair[0],
        )
    )
    return indexed


def select_assistant_texts_for_snapshot(assistant_texts: Sequence[str]) -> list[str]:
    """Prefer first context + latest assistants (fixes earliest-only [:2] loss)."""
    cleaned = [t.strip() for t in assistant_texts if t and str(t).strip()]
    if not cleaned:
        return []
    if len(cleaned) <= MAX_ASSISTANTS_FOR_SNAPSHOT:
        return list(cleaned)
    first = cleaned[0]
    tail = cleaned[-(MAX_ASSISTANTS_FOR_SNAPSHOT - 1) :]
    out: list[str] = []
    seen: set[str] = set()
    for item in [first, *tail]:
        key = re.sub(r"\s+", " ", item.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= MAX_ASSISTANTS_FOR_SNAPSHOT:
            break
    return out


def _select_indices(
    ordered: list[tuple[int, MirrorConversationMessageDTO]],
) -> tuple[list[int], Optional[str]]:
    """Return selected original indices + truncation reason."""
    if len(ordered) <= MAX_SELECTED_MESSAGES:
        # Still apply char budget.
        selected_idx = [i for i, _ in ordered]
    else:
        users = [(i, m) for i, m in ordered if m.role == "user"]
        assistants = [(i, m) for i, m in ordered if m.role == "assistant"]

        user_indices = [i for i, _ in users]
        if len(user_indices) <= HEAD_USER + TAIL_USER:
            keep_users = user_indices
        else:
            head = user_indices[:HEAD_USER]
            tail = user_indices[-TAIL_USER:]
            middle = user_indices[HEAD_USER:-TAIL_USER]
            mid_msgs = [(i, next(m for j, m in users if j == i)) for i in middle]

            def _score(pair: tuple[int, MirrorConversationMessageDTO]) -> tuple:
                t = pair[1].text
                return (
                    1 if _QUESTION_RE.search(t) or "?" in t else 0,
                    1 if _CORRECTION_RE.search(t) else 0,
                    1 if _PREFERENCE_RE.search(t) else 0,
                    1 if len(t) >= 40 else 0,
                    len(t),
                )

            mid_sorted = sorted(mid_msgs, key=_score, reverse=True)
            mid_pick = [i for i, _ in mid_sorted[:MID_USER_PICK]]
            keep_set = set(head + mid_pick + tail)
            keep_users = [i for i in user_indices if i in keep_set]

        # Assistants: first + last two (by chronology in ordered list)
        asst_idx = [i for i, _ in assistants]
        if len(asst_idx) <= MAX_ASSISTANTS_FOR_SNAPSHOT:
            keep_asst = asst_idx
        else:
            keep_asst = [asst_idx[0], *asst_idx[-(MAX_ASSISTANTS_FOR_SNAPSHOT - 1) :]]
            # unique preserve order
            seen: set[int] = set()
            uniq: list[int] = []
            for i in keep_asst:
                if i not in seen:
                    seen.add(i)
                    uniq.append(i)
            keep_asst = uniq[:MAX_ASSISTANTS_FOR_SNAPSHOT]

        keep = set(keep_users + keep_asst)
        selected_idx = [i for i, _ in ordered if i in keep]

    # Char budget trim (drop from middle of selection, keep first user + last two)
    truncation_reason: Optional[str] = None
    if len(ordered) > MAX_SELECTED_MESSAGES:
        truncation_reason = "message_cap"

    def _char_sum(indices: list[int]) -> int:
        total = 0
        lookup = {i: m for i, m in ordered}
        for i in indices:
            m = lookup[i]
            cap = MAX_USER_TEXT_CHARS if m.role == "user" else MAX_ASSISTANT_TEXT_CHARS
            total += min(len(m.text), cap)
        return total

    while _char_sum(selected_idx) > MAX_CONTEXT_MESSAGE_CHARS and len(selected_idx) > 3:
        # Drop earliest non-head selected message (index position >= 2)
        drop_pos = None
        for pos in range(2, len(selected_idx) - 1):
            drop_pos = pos
            break
        if drop_pos is None:
            break
        selected_idx.pop(drop_pos)
        truncation_reason = truncation_reason or "char_budget"

    return selected_idx, truncation_reason


def _make_evidence(
    message_index: int,
    role: str,
    text: str,
    sequence: Optional[int],
) -> MirrorContextEvidenceRef:
    return MirrorContextEvidenceRef(
        messageIndex=message_index,
        role=role,  # type: ignore[arg-type]
        excerpt=_excerpt(text),
        sequence=sequence,
    )


def _classify_user_detail(
    text: str,
    message_index: int,
    sequence: Optional[int],
) -> Optional[MirrorSalientDetailV1]:
    evidence = _make_evidence(message_index, "user", text, sequence)
    if _CORRECTION_RE.search(text):
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="correction",
            speaker="user",
            epistemic="user_stated",
            evidence=evidence,
        )
    if _REJECT_RE.search(text):
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="constraint",
            speaker="user",
            epistemic="rejected_option",
            evidence=evidence,
        )
    if _PREFERENCE_RE.search(text):
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="preference",
            speaker="user",
            epistemic="user_preference",
            evidence=evidence,
        )
    if _COMPARISON_RE.search(text):
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="comparison",
            speaker="user",
            epistemic="user_stated",
            evidence=evidence,
        )
    if _QUESTION_RE.search(text) or "?" in text or "？" in text:
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="question",
            speaker="user",
            epistemic="user_stated",
            evidence=evidence,
        )
    if len(text.strip()) >= 12:
        return MirrorSalientDetailV1(
            text=_excerpt(text, 180),
            kind="other",
            speaker="user",
            epistemic="user_stated",
            evidence=evidence,
        )
    return None


def _classify_assistant_detail(
    text: str,
    message_index: int,
    sequence: Optional[int],
) -> MirrorSalientDetailV1:
    evidence = _make_evidence(message_index, "assistant", text, sequence)
    epistemic = "uncertain" if _UNCERTAIN_ASSIST_RE.search(text) else "assistant_suggestion"
    return MirrorSalientDetailV1(
        text=_excerpt(text, 180),
        kind="other",
        speaker="assistant",
        epistemic=epistemic,  # type: ignore[arg-type]
        evidence=evidence,
    )


def build_mirror_conversation_context_v1(
    messages: Sequence[MirrorConversationMessageDTO],
    *,
    conversation_id: str | None = None,
    locale: str | None = "tr",
) -> MirrorConversationContextV1:
    ordered = _order_messages(list(messages))
    selected_idx, truncation_reason = _select_indices(ordered)
    lookup = {i: m for i, m in ordered}

    selected_messages: list[MirrorContextMessageV1] = []
    for i in selected_idx:
        m = lookup[i]
        cap = MAX_USER_TEXT_CHARS if m.role == "user" else MAX_ASSISTANT_TEXT_CHARS
        selected_messages.append(
            MirrorContextMessageV1(
                messageIndex=i,
                role=m.role,
                text=m.text[:cap],
                sequence=m.sequence,
            )
        )

    users_all = [(i, m) for i, m in ordered if m.role == "user"]
    asst_all = [(i, m) for i, m in ordered if m.role == "assistant"]

    opening = _excerpt(users_all[0][1].text, 200) if users_all else None
    current = _excerpt(users_all[-1][1].text, 200) if users_all else None

    development: list[str] = []
    for i, m in users_all:
        if i == users_all[0][0]:
            continue
        if users_all[-1][0] == i and len(users_all) > 1:
            continue
        beat = _excerpt(m.text, 160)
        if beat and beat not in development:
            development.append(beat)
        if len(development) >= 8:
            break

    direction_changes: list[str] = []
    for i, m in users_all:
        if _CORRECTION_RE.search(m.text) or _COMPARISON_RE.search(m.text):
            direction_changes.append(_excerpt(m.text, 160))
        if len(direction_changes) >= 6:
            break

    arc = MirrorConversationArcV1(
        openingIntent=opening,
        developmentBeats=development,
        currentState=current,
        directionChanges=direction_changes,
    )

    salient: list[MirrorSalientDetailV1] = []
    preferences: list[MirrorSalientDetailV1] = []
    corrections: list[MirrorSalientDetailV1] = []
    questions: list[MirrorSalientDetailV1] = []
    grounding: list[MirrorSalientDetailV1] = []
    uncertainty_notes: list[str] = []

    for i, m in users_all:
        detail = _classify_user_detail(m.text, i, m.sequence)
        if not detail:
            continue
        salient.append(detail)
        if detail.kind == "preference" or detail.epistemic == "user_preference":
            preferences.append(detail)
        if detail.kind == "correction":
            corrections.append(detail)
        if detail.kind == "question":
            questions.append(detail)
        if detail.epistemic in {"user_stated", "user_preference", "accepted_decision"}:
            grounding.append(detail)
        if detail.epistemic == "rejected_option":
            grounding.append(detail)

    for i, m in asst_all:
        # Only assistants that remain in the selected set (or first+last for notes)
        if i not in selected_idx and i not in {asst_all[0][0], asst_all[-1][0]}:
            continue
        detail = _classify_assistant_detail(m.text, i, m.sequence)
        if detail.epistemic in {"uncertain", "assistant_suggestion", "hypothesis"}:
            uncertainty_notes.append(
                f"Assistant content at index {i} treated as suggestion/uncertain — not user-confirmed."
            )
            if len(uncertainty_notes) <= 8:
                salient.append(detail)

    # Later user corrections supersede earlier assumptions in grounding order:
    # keep chronological; consumers should prefer later corrections.
    exclusions = [
        "no_visual_prescription",
        "no_scene_summary",
        "no_metaphor",
        "no_image_prompt",
        "creative_authority_none",
    ]

    user_n = sum(1 for _, m in ordered if m.role == "user")
    asst_n = sum(1 for _, m in ordered if m.role == "assistant")
    char_estimate = sum(len(m.text) for m in selected_messages)

    diagnostics = MirrorConversationContextDiagnosticsV1(
        sourceMessageCount=len(ordered),
        selectedMessageCount=len(selected_messages),
        omittedMessageCount=max(0, len(ordered) - len(selected_messages)),
        userMessageCount=user_n,
        assistantMessageCount=asst_n,
        charEstimate=char_estimate,
        truncationReason=truncation_reason,
        correctionCount=len(corrections),
        preferenceCount=len(preferences),
        unresolvedQuestionCount=len(questions),
        rejectedOptionCount=sum(1 for d in grounding if d.epistemic == "rejected_option"),
        contextVersion=MIRROR_CONVERSATION_CONTEXT_VERSION,
    )

    coverage_parts = [
        f"users={user_n}",
        f"assistants={asst_n}",
        f"selected={len(selected_messages)}",
    ]
    if truncation_reason:
        coverage_parts.append(f"trunc={truncation_reason}")
    if corrections:
        coverage_parts.append(f"corrections={len(corrections)}")

    return MirrorConversationContextV1(
        version=MIRROR_CONVERSATION_CONTEXT_VERSION,
        conversationId=(conversation_id or None),
        locale=locale,
        messages=selected_messages[:40],
        conversationArc=arc,
        salientDetails=salient[:24],
        userPreferences=preferences[:12],
        correctionsAndRevisions=corrections[:12],
        unresolvedQuestions=questions[:12],
        factualGrounding=grounding[:16],
        uncertaintyNotes=uncertainty_notes[:12],
        exclusions=exclusions,
        sourceCoverage="; ".join(coverage_parts),
        diagnostics=diagnostics,
        creativeAuthority="none",
    )


def assert_context_has_no_creative_fields(ctx: MirrorConversationContextV1) -> None:
    """Test helper — D1 package must not carry D2 visual fields."""
    dumped = ctx.model_dump()
    forbidden = {
        "visualThesis",
        "sceneSummary",
        "cinematicConcept",
        "emotionalCenter",
        "metaphor",
        "curiosityGap",
        "imagePrompt",
        "composition",
        "lighting",
        "camera",
        "style",
        "artDirection",
    }

    def _walk(obj: object) -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in forbidden:
                    raise AssertionError(f"creative field leaked into D1 context: {k}")
                _walk(v)
        elif isinstance(obj, list):
            for item in obj:
                _walk(item)

    _walk(dumped)
    if ctx.creativeAuthority != "none":
        raise AssertionError("creativeAuthority must be none")
