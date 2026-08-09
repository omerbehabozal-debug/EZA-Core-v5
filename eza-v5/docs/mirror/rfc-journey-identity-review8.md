# RFC — Mirror Journey Identity + Review 8

Status: **Accepted product locks; Phase 1 PASS + Phase 2 deterministic 8-window lifecycle**  
Date: 2026-08-08 (window model reset 2026-08-09)  
Scope: Phase 1 = DB + identity + flag; Phase 2 = eligible pairing + **deterministic 8-question windows** + Review 8 consent (no scoped D2 / replay yet)  
Depends on: D2 reliability baseline, Semantic Anchors, Curiosity Builder, Narrative Alignment  

**Phase 1 notes:** see `journey-identity-phase1.md`. Versioning **option A** locked (same slug, bump `journey_version`).  
**PASS closure:** legacy partial unique index; `mirror_journey_steps.journey_version`; strict `EZA_MIRROR_JOURNEY_V1` parse.  
**Phase 2 notes:** see `journey-phase2-review8.md` + `journey-phase2-pass-closure.md`.  

**Product model reset:** Journey V1 authority is chronological windows (Q1–Q8, Q9–Q16) under a 20-question conversation cap. Candidate 8 / best-8 / topic clustering are **not** Journey V1 authority.

---

## 0. Locked product decisions

| # | Decision | Implication |
|---|----------|-------------|
| 1 | **Identity = `journeyId`** | `conversationId` is provenance only. One conversation may yield N journeys. |
| 2 | **Legacy test mirrors = no replay** | Nodes without journey steps are Discover/landing-only. No complex legacy fallback. Clean up later. |
| 3 | **Review 8 before image** | User confirms 8 Q/A → then scoped D2 → Anchors → Curiosity Builder → image → Narrative Alignment → publish. |
| 4 | **Replay answers = stored A1–A8** | Progressive UI reveal of canonical text. No live LLM regen of published answers. |

---

## 1. Problem

Today:

- Unique `(user_id, conversation_id)` → one network node per conversation.
- Publish stores landing + scene, not 8 Q/A pairs.
- Sohbet continues via generative chat, not stored replay.

Target:

- One published **Yansı** = exactly 8 chronological eligible user questions + 8 stored AI answers (one frozen window).
- Same source conversation may publish multiple journeys (vertical parent chain).
- Visitor replays Q1→A1→…→Q8 as natural chat; after A8, free continuation may fork a child journey.

---

## 2. Identity model

### 2.1 Canonical IDs

| ID | Role |
|----|------|
| `journeyId` | Public product identity (maps to network `slug` or UUID; **primary publish key**) |
| `sourceConversationId` | Optional provenance of the chat that produced the 8 |
| `parentJourneyId` | Optional parent Yansı (`parent_slug` today) |
| `ownerId` | Publisher user |

### 2.2 Idempotency (replaces conversation-unique publish)

| Operation | Key | Behavior |
|-----------|-----|----------|
| Create draft | `(ownerId, sourceConversationId, draftKey)` optional | Soft draft uniqueness for UX |
| Publish new | **new** `journeyId` / `slug` | Always new node when user confirms a new 8 |
| Republish / version bump | `(journeyId, version)` | Explicit update; does not silently mutate another journey |
| Legacy path | `(user_id, conversation_id)` | **Deprecated** for new publishes; keep read path for old nodes |

**Rule:** Publishing must **not** upsert by `conversationId` alone.

---

## 3. Data model

### 3.1 `MirrorJourney` (logical; physical options below)

```
journeyId              string (slug) — unique
ownerId                uuid
sourceConversationId   string | null   — NOT unique
parentJourneyId        string | null   — parent slug
version                int >= 1
status                 draft | published | superseded
locale                 tr | en | ar

# Meaning lineage (after Review 8 confirm)
interpretationHash     string | null
anchorsHash            string | null
publicLandingHash      string | null
sceneAssetId           string | null
generationId           string | null

publicTitle            string
publicSummary          string
continuationContext    string | null   — private to owner / sohbet, not Discover body

cardDate               string
visibility             public | unlisted | private
safetyStatus           open | review | restricted

publishedAt            timestamptz | null
createdAt / updatedAt
```

### 3.2 `MirrorJourneyStep` (exactly 8 when published)

```
journeyId
index                  1..8  UNIQUE (journeyId, index)
sourceUserMessageId    string
sourceAssistantMessageId string
publicQuestion         text   — frozen at confirm
publicAnswer           text   — frozen at confirm
questionHash           string
answerHash             string
sanitizationFlags      string[]  — e.g. pii_redacted
```

Invariant: published journey has **exactly 8** steps; order immutable for that `version`.

### 3.3 Physical storage options (recommendation)

**Recommended: hybrid**

1. Keep `mirror_network_nodes` as Discover/public card host (`slug` = `journeyId`).
2. Add columns:
   - `journey_version int not null default 1`
   - `source_conversation_id` (rename clarity; keep existing `conversation_id` as alias initially)
   - `artifact_kind`: `legacy_landing` | `journey_v1`
3. Add table `mirror_journey_steps` (normalized) **or** JSONB `selected_steps` on node with length==8 check.

Normalized steps preferred for replay queries and hash integrity.

**Drop / replace:**

```sql
-- TODAY (blocker)
UNIQUE (user_id, conversation_id) WHERE conversation_id IS NOT NULL
  -- name: uq_mirror_network_nodes_user_conversation

-- TARGET
-- Remove conversation uniqueness for new writes.
-- Add: UNIQUE (slug) already exists.
-- Optional: UNIQUE (user_id, journey_id) if journey_id ≠ slug.
-- Optional draft: UNIQUE (user_id, source_conversation_id, draft_slot) for in-progress only.
```

Migration strategy:

1. Create `mirror_journey_steps`.
2. Add `artifact_kind` default `legacy_landing` for existing rows.
3. Drop `uq_mirror_network_nodes_user_conversation` after deploy flag `journey_identity_v1`.
4. New publishes set `artifact_kind = journey_v1` + 8 steps.
5. Legacy rows: Discover OK; replay endpoint returns `404 legacy_not_replayable`.

---

## 4. Source message pairing

### 4.1 Eligible pair definition

A pair is:

1. User message `U` with non-empty text, not system/limit noise.
2. The **first subsequent** assistant message `A` with non-empty text.
3. Stable IDs: `U.id`, `A.id` from chat archive / live messages.

### 4.2 Algorithm (deterministic)

```
pairs = []
for each message M in chronological order:
  if M is assistant:
    U = nearest prior user with text
    if U and (U.id, M.id) not yet used:
      pairs.append({ userId: U.id, assistantId: M.id, q: U.text, a: M.text })
```

Reject: orphan assistants, consecutive users without answer, duplicate reuse of same user turn.

### 4.3 Window selection (Journey V1 — locked)

Conversation max = **20** eligible completed pairs.  
Yansı size = **8**. Publishable windows are chronological:

- Window 0: pairs 0–7 (Q1–Q8)
- Window 1: pairs 8–15 (Q9–Q16)
- Pairs 16–19 (Q17–Q20) never form a Yansı

After each full window completes, the user decides:

- create Yansı (Review 8 consent on **that exact window**) and continue, or
- skip (window unpublished forever; never mixed with later windows)

**Superseded:** Candidate 8 / best-8 scoring / topic clustering are **not** Journey V1 authority.

User confirm writes `selectedSteps[8]` into draft; answers copied by value (frozen).

### 4.4 Risks

| Risk | Mitigation |
|------|------------|
| Pairing heuristic wrong | Confirm UI shows Q+A together; window is chronological only |
| Answer references earlier skipped context | Accept for v1; Phase 3 scoped meaning may note continuity |
| Source message later deleted | Published copy is frozen text; IDs are provenance only |
| Extremely long answers | Store full; UI progressive reveal + scroll (no silent truncate in v1) |

---

## 5. Review 8 → meaning pipeline (order locked)

```
Eligible pairs from source conversation (max 20)
        ↓
Every completed chronological 8 → user decision
        ↓
[Create] exact window → USER REVIEW / CONFIRM 8   ← hard gate (consent only)
[Skip]   window unpublished forever
        ↓
Build publish-scoped message package = only those 8 Q/A
        ↓
D1/D2 on scoped package only     ← Phase 3 (`journey-phase3-scoped-d2.md`)
        ↓
Semantic Anchors
        ↓
Curiosity Builder → publicTitle / publicSummary
        ↓
Scene prompt + image
        ↓
Narrative Alignment (hard claims vs image)
        ↓
Persist journey + 8 steps + landing + scene + lineage
```

**Forbidden after confirm:** re-reading full conversation into D2 for that publish.

---

## 6. Publish idempotency & versioning

### 6.1 New journey

- Client sends `journeyId` (or server allocates slug) + `selectedSteps[8]` + meaning hashes.
- Insert new `mirror_network_nodes` row; **never** lookup-by-conversation upsert.

### 6.2 Same journey update (“Aynayı Güncelle” for journey_v1)

Options (pick one in implementation sprint):

**A (preferred):** bump `version`, write new steps snapshot, supersede previous public meaning/image; same `slug` for Discover stability.  
**B:** new slug for each material change (harder for share URLs).

Stale guards reuse existing `generationId` / `replacesGenerationId` / `forceRepublish` under `mirrorLineage`.

### 6.3 Child journey (post-replay continuation)

- New conversation or continuation thread accumulates pairs.
- User confirms new 8 → **new** `journeyId`.
- `parentJourneyId` = experienced journey slug (via existing lineage proof token).

`yansiCount` remains: count of child nodes with `parent_slug = this.slug` where `artifact_kind` eligible.

---

## 7. Replay contract (design only)

### 7.1 API sketch

`GET /api/mirror-network/{slug}/journey`

- If `artifact_kind != journey_v1` → `410` / `legacy_not_replayable`
- Else return ordered steps `{ index, publicQuestion, publicAnswer }` (no private IDs required for visitor)

### 7.2 Client state machine

```
ENTER → button[Q1]
TAP i → append user(Qi) → progressive reveal assistant(Ai) → button[Q{i+1}]
AFTER 8 → freeform + exit
```

No progress chrome; no list of all 8; no regen.

---

## 8. API surface (Phase 1–2)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/mirror-network/journey/candidates` | Propose 8 / multi-path from conversation messages |
| `POST /api/mirror-network/journey/draft` | Save confirmed 8 (pre-image) |
| `POST /api/mirror-network/journey/prepare-meaning` | Scoped D2 from draft steps |
| `POST /api/standalone/mirror/generate-scene` | Unchanged provider; prompt from scoped meaning |
| `POST /api/mirror-network/publish` | Requires `journeyId` + steps when flag on; stop conversation upsert |
| `GET /api/mirror-network/{slug}/journey` | Replay payload |

Feature flag: `EZA_MIRROR_JOURNEY_V1=1`.

---

## 9. Frontend surface (Phase 1–2)

1. **Review8Screen** — list of 8 Q/A, replace/remove, confirm CTA.  
2. Gate existing “Yayınla” behind confirm.  
3. Do not change Discover card layout yet.  
4. Replay UI deferred to Phase 5 (after persist).

---

## 10. Compatibility matrix

| System | Change |
|--------|--------|
| D2 reliability | Input becomes scoped 8-package; pipeline unchanged |
| Semantic Anchors / CB / NA | Unchanged; fed by scoped D2 + landing |
| `yansiCount` | Unchanged semantics (child journeys) |
| Legacy nodes | Landing/Discover only; no replay |
| V3 | Still forbidden |

---

## 11. Migration sequence (implementation order)

1. **RFC freeze** (this doc) + flag  
2. DB: steps table + `artifact_kind`; dual-write readiness  
3. Drop conversation unique under flag (with rollback plan)  
4. Pairing + **deterministic window** state (20-cap; 8-step windows)  
5. Decision UI + Review 8 consent + draft persist (multi-journey draftKey)  
6. Scoped D2 prepare from confirmed window (**Phase 3**)  
7. Publish writes `journey_v1` + 8 steps (no conversation upsert)  
8. Replay API + UI  
9. Discover CTA → replay for `journey_v1` only  
10. Cleanup legacy test nodes (ops)

---

## 12. Tests required (when coding)

- Pairing: consecutive users, orphan assistant, system/tool/noise, incomplete  
- Windows A–K: create/skip/parent chain/20-end/refresh/independence/flag-off  
- Confirm freezes answer text (exact chronological 8)  
- Publish does not upsert by conversationId  
- Two journeys same `sourceConversationId` with distinct draft/window identity  
- Legacy GET journey → not replayable  
- Scoped D2 ignores out-of-window messages (fixture) — Phase 3  
- NA/CB still pass on scoped meaning — Phase 3  
- yansiCount counts children only  

---

## 13. Open items (non-blocking for RFC)

- Versioning A vs B for same-slug updates  
- Max answer length UX  
- PII sanitizer depth on confirm  
- Whether draft lives client-only until prepare-meaning  

---

## 14. Explicit non-goals (this RFC)

- Full Vision Verify  
- Live regen of A1–A8  
- Legacy replay fallback  
- Graph UI / “node 384” language  
- Implementing code in this document  

---

## Final invariant

> One published Yansı (`journey_v1`) is one coherent curiosity journey of exactly eight confirmed user questions and their frozen AI answers, addressed by `journeyId`, optionally sourced from a conversation, optionally parented by another journey.
