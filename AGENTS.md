# AGENTS.md — EZA Core Agent Instructions

Guidance for AI coding agents working in **EZA-Core-v4.0** (EZA v5 monorepo).

---

## Governance

**If user instructions conflict with this file, ask for confirmation before changing protected areas.**

For **clearly scoped Mirror tasks**, edits inside Mirror-specific files are allowed without extra confirmation. **Confirmation is required** when changing shared infrastructure, auth, middleware, deployment config, database models, secrets, or duplicated root trees.

### Priority Order

1. **Direct user instructions**
2. **AGENTS.md safety rules**
3. **Existing repository conventions**

When priorities conflict, follow the higher item unless the user explicitly overrides a protected-area rule after you ask for confirmation.

### Safety rules (always)

- Do **not** commit or push without explicit user instruction.
- Do **not** modify root `backend/` or root `frontend/` unless explicitly approved.
- Do **not** weaken CI.
- Do **not** expose or commit secrets.

---

## Repository layout

| Path | Role |
|------|------|
| `eza-v5/frontend/` | **Primary** Next.js app — Standalone Mirror, platform, proxy, corporate |
| `eza-v5/backend/` | **Primary** FastAPI API — auth, mirror scene generation, standalone |
| `eza-v5/docs/mirror/` | Mirror product/architecture notes |
| `frontend/` (repo root) | Mirror-less duplicate/parallel UI tree (see note below) |
| `backend/` (repo root) | Substantial duplicate (see note below) |
| `eza-v5/vercel.json` | Monorepo-level Vercel config (alongside root and frontend configs) |

**Root `frontend/`** is a substantial mirror-less duplicate/parallel UI tree. It contains proxy, proxy-lite, corporate, and regulator UI surfaces, but EZA Mirror routes live under `eza-v5/frontend/`.

**Root `backend/` and `eza-v5/backend/`** are both substantial. Active development defaults to `eza-v5/backend/`, but root `backend/` must be treated as a serious duplicate, not a small legacy folder.

**Vercel Root Directory** for Standalone production: `eza-v5/frontend` (not repo-root `frontend/`).

**Production domains:** `standalone.ezacore.ai`, `api.ezacore.ai`, etc. — see `eza-v5/frontend/middleware.ts`.

### Active folders (reference)

| Path | Role |
|------|------|
| `eza-v5/apps/finance/` | Finance domain panel |
| `eza-v5/apps/health/` | Health domain panel |
| `eza-v5/apps/rtuk/` | RTÜK domain panel |
| `eza-v5/apps/sanayi/` | Sanayi domain panel |
| `eza-v5/apps/regulator/` | Separate regulator panel |
| `.github/` | CI workflows |
| `docs/` (repo root) | Top-level documentation |
| `docker-compose.yml` | Local / deploy orchestration (repo root) |
| `eza-v5/loadtest/` | Load-test assets |

### Mirror-critical paths

| Path | Role |
|------|------|
| `eza-v5/frontend/app/standalone/mirror/` | Daily Mirror routes (`daily`, `pattern`, layout) |
| `eza-v5/frontend/lib/apiUrl.ts` | API base URL / same-origin `*.ezacore.ai` routing |
| `eza-v5/frontend/lib/eza/mirror/generateSceneApi.ts` | Scene generation client |
| `eza-v5/frontend/lib/eza/mirror/dailyMirrorSnapshot.ts` | Daily snapshot hydrate/persist |
| `eza-v5/frontend/lib/eza/mirror/mirrorSceneCache.ts` | Client scene URL cache |
| `eza-v5/frontend/lib/eza/mirror/copy.ts` | Mirror product copy strings |

---

## Product rules — Daily Mirror (non-negotiable)

Daily Mirror is **not** a character card, personality test, or mascot system.

It is the **visual metaphor of that day’s human–AI story**.

Pipeline order (P4-A+):

```
Entries → Intent Lock → Narrative Core → Story Tension → Mirror Moment
       → Scene Archetype → Theme → Identity → Full Canvas Prompt → Scene API
```

- **Identity is an outcome**, not the primary driver of scene composition.
- **Onboarding PNGs** (`public/mirror/onboarding-preview-*.png`) are design references; they are **not** wired to the live daily pipeline unless explicitly sprinted.
- **Dev Italy fixture** (`/dev/mirror-poster`, `devPosterFixtures.ts`, `dev-italy-scene.jpg`) is **QA-only** — not the production daily route.

Current quality sprint: **P4-F Live Scene Quality Alignment** (before SENAI global design system).

---

## Working conventions

### Scope

- **Minimize diff** — fix only what the task requires.
- Match existing naming, imports, and test patterns in `eza-v5/`.
- Do **not** commit unless the user explicitly asks.
- Do **not** push unless the user explicitly asks.
- Do **not** update `git config`.

### Mirror / frontend

- In-app card: `DailyMirrorPosterCard` + `StandaloneObservationExperience`
- Share artifact: `DailyMirrorSharePoster` (Plus-gated per P4-D)
- Copy strings: `eza-v5/frontend/lib/eza/mirror/copy.ts`
- Plan/entitlement: `planStore.ts`, `fetchAuthMe.ts`, backend `mirror_plan`
- Scene API: `generateSceneApi.ts` → `POST /api/standalone/mirror/generate-scene`
- Production API on `*.ezacore.ai`: same-origin `/api/...` (Vercel rewrite)

### Backend

- Mirror scene: `eza-v5/backend/routers/standalone_mirror.py`, `services/mirror/`
- Default image provider: `mock` unless `EZA_MIRROR_IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`
- OpenAI combined prompt capped at **4000 chars** in `openai_prompt_builder.py`

### Tests

- Frontend: `eza-v5/frontend/tests/` (Vitest)
- Run targeted tests for mirror changes; avoid trivial assertions.
- Exclude `tsconfig.tsbuildinfo` from commits (build artifact).

### Commits (when requested)

- One logical change per commit; message explains **why**.
- Never commit `.env`, secrets, or credentials.
- Never use destructive git commands unless explicitly requested.
- `eza-v5/frontend/tsconfig.tsbuildinfo` is a build artifact and must not be committed unless explicitly requested.

---

## Protected areas

Confirmation required before editing **shared infrastructure, auth, deployment, secrets, or root duplicates** — especially when the request is broad or indirect (e.g. “refactor everything”, “clean up deploy”).

### Shared infrastructure & deploy

- `eza-v5/frontend/middleware.ts`
- `eza-v5/frontend/vercel.json`
- `eza-v5/vercel.json`
- `vercel.json` (repo root)
- `.github/` — do not weaken CI

### Auth & production users

- `eza-v5/backend/routers/production_auth.py`
- `eza-v5/frontend/context/AuthContext.tsx`
- `eza-v5/backend/models/production.py` (`mirror_plan` field)
- `eza-v5/backend/auth/mirror_entitlement.py`

### Duplicated root trees (edit only with explicit approval)

- `frontend/` (repo root)
- `backend/` (repo root)
- `backend/policy_engine/` (root copy — prefer `eza-v5/backend/policy_engine/`)

### Safety & policy (read-mostly)

- `eza-v5/backend/training/` — **closed** pipeline
- `eza-v5/backend/LEARNING_INFRASTRUCTURE_README.md` — passive learning; do not wire into inference
- `eza-v5/backend/policy_engine/` — policy maps and thresholds

### Mirror-specific work (no extra confirmation when task is clearly scoped)

Mirror narrative, prompt engine, poster UI, plan gates, scene API, snapshot/cache, and `eza-v5/frontend/app/standalone/mirror/` may be edited freely when the user’s task is explicitly Mirror-related (e.g. P4-F, scene quality, daily UX).

---

## Explicitly out of scope unless requested

- **SENAI** global rebrand / design-system migration
- Mirror **history / timeline** (product decision: no history)
- Rewiring onboarding PNGs into live `generate-scene` without a named sprint
- Force-push to `main`, hard reset, or skipping git hooks
- Modifying unrelated panels (proxy, corporate, regulator) during mirror tasks

---

## Local development quick reference

```bash
# Frontend (Standalone Mirror)
cd eza-v5/frontend && npm run dev
# → http://localhost:3000/standalone/mirror/daily

# Dev poster QA (Italy fixture — NOT production daily)
# → http://localhost:3000/dev/mirror-poster

# Backend
cd eza-v5/backend && uvicorn backend.main:app --reload --port 8000
```

---

## Agent checklist before finishing mirror work

1. Did the change touch a **protected shared area**? If yes, was confirmation obtained?
2. Are **Free vs Plus** gates preserved (P4-D)?
3. Does scene generation still require **auth** where the API expects it?
4. If prompt-related: note **4000-char** backend truncation risk.
5. Tests / `tsc` run for touched packages?
6. No commit/push unless user asked?
7. `tsconfig.tsbuildinfo` and secrets excluded from staging?

---

*Last updated: agent onboarding for EZA-Core-v4.0 / eza-v5 mirror workstreams (P4-A through P4-F).*
