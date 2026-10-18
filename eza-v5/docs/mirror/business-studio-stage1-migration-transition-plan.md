# Business AI Studio Stage 1 — Production Alembic transition plan

**Status:** planning only. This document does **not** authorize production stamp, upgrade, deploy, or `railway down`.

**Feature commit:** `b2a932b` (`feat(bilign): add Business AI Studio Stage 1 admission infrastructure`)  
**Admission flag:** keep `BILIGN_STUDIO_ADMISSION_ENABLED` unset/false until after a deliberate, approved cutover.

---

## 1. Observed production drift (read-only, 2026-10)

| Check | Result |
| --- | --- |
| `alembic_version` | `add_yansi_identity_gen_g885_v1` (single row) |
| Studio tables (`business_studio_generations`, `business_studio_usage`) | **absent** |
| `user_capabilities` | **present** |
| `business_*` tenant tables | **present** (profiles, members, knowledge, drafts, publications, applications, …) |
| Code head after Stage 1 | `add_business_studio_v1` → down_revision `add_user_capabilities_v1` |

**Diagnosis:** live DDL for Business / capabilities (and likely some earlier revisions) was applied while `alembic_version` was left behind at the Yansı identity revision. Schema is **ahead** of the stamp; Studio DDL is **not** yet applied.

Blind `alembic upgrade head` from the current stamp would re-run non-idempotent `CREATE TABLE` for objects that already exist → hard failure / operational risk. Blind `alembic stamp head` would claim Studio tables exist when they do not → worse.

---

## 2. Revision chain (stamp → Stage 1 head)

```
add_yansi_identity_gen_g885_v1          ← production stamp today
  → add_mirror_network_saves_slice5_v1  (mirror_network_saves)
  → add_yansi_katki_phase1_v1           (yansi_contributions, yansi_contribution_reports)
  → add_yansi_editorial_v1              (yansi_editorial_versions)
  → add_guest_trial_v1                  (guest_trials)
  → add_business_yansi_v1               (business_profiles, members, knowledge, drafts, publications)
  → add_business_applications_v1        (business_brand_applications, business_application_events)
  → add_user_capabilities_v1            (user_capabilities)  [idempotent has_table guard]
  → add_business_studio_v1              (business_studio_generations, business_studio_usage)  ← NEW
```

Only `add_user_capabilities_v1` is safely re-runnable. Business / guest / editorial / saves / katki upgrades are plain `create_table` and must **not** be re-executed if tables already exist.

`add_business_studio_v1` is additive and empty-table-safe on a clean DB; downgrade refuses if usage/provenance rows exist.

---

## 3. Backup verification (current artifact)

| Artifact | Notes |
| --- | --- |
| `eza-v5/backend/data/prod_pg_dump_20260913-014215.dump` | Custom format, header `PGDMP`, dump version 1.16, source PG **17.11** |
| Listability | `docker run --rm -v … postgres:17 pg_restore -l` succeeds (TOC ~424 entries) |
| Local PG15 | Cannot list 1.16 archives — use PG17+ client/tools |
| Content lag | Dump dated **2026-09-12**; TOC has **no** `business_*` / `user_capabilities` tables |

**Verdict:** the existing dump is **format-valid and restorable with PG17 tooling**, but it is **not** a current pre-Studio snapshot of production (Business schema landed after this dump). Before any production Alembic reconcile, take a **fresh** `pg_dump -Fc` with PG17 and verify `pg_restore -l` on that new file.

---

## 4. No-data-loss transition procedure (future, gated)

Do **not** run these steps in this integration window. When a cutover is explicitly approved:

### Phase A — Fresh backup + inventory

1. Fresh logical backup: `pg_dump -Fc` (PG17) of production; store off-box; `pg_restore -l` + size/checksum record.
2. Read-only inventory for every object in §2 (tables, critical indexes/constraints, row counts > 0).
3. Classify each revision between stamp and `add_user_capabilities_v1`:
   - **Already applied (DDL present, matches expected columns/constraints)** → stamp-eligible only.
   - **Missing** → must be applied via `upgrade` (not stamp).
   - **Partial / divergent** → **STOP**; write a one-off reconcile migration; never stamp over mismatch.

### Phase B — Reconcile stamp to capabilities (no Studio yet)

For each revision in order from `add_mirror_network_saves_slice5_v1` through `add_user_capabilities_v1`:

- If DDL already correct: `alembic stamp <that_revision>` **only** (moves version pointer; no DDL).
- If DDL missing: `alembic upgrade <that_revision>` (additive create).
- Never skip ahead with `stamp head`.
- Never stamp `add_business_studio_v1` before its tables exist.

Target after Phase B: `alembic_version == add_user_capabilities_v1` and Studio tables still absent.

### Phase C — Apply Studio only

1. Confirm admission flag remains **false**.
2. `alembic upgrade add_business_studio_v1` (creates empty Studio tables only).
3. Verify tables/indexes/check constraints; confirm no unexpected data.
4. Smoke: admission endpoints return **503** while flag off (no Studio query path required).

### Phase D — Activate admission (separate change window)

Enable `BILIGN_STUDIO_ADMISSION_ENABLED` only after Phase C verification and product GO. Stage 1 still does not call providers; it only persists `blocked` admissions.

### Explicit non-goals / forbidden shortcuts

- No `alembic stamp head` while Studio tables are missing.
- No blind `upgrade head` from the lagging stamp.
- No `downgrade` of Business / Studio tables that contain rows.
- No `railway down` for schema work.
- No Stage 2 worker/AI execution in this plan.

---

## 5. Application integration vs production schema

| Layer | Safe now? |
| --- | --- |
| Merge Stage 1 code to `main` (admission default OFF) | Yes — offline/code path |
| Production deploy of Stage 1 code with flag OFF | Acceptable only if deploy does not require Studio tables (flag short-circuits). Prefer deploy **after** Phase C if any code path imports models at startup in a way that touches missing tables — verify first. |
| Production Alembic upgrade/stamp | **NO-GO** until Phase A–B inventory + fresh backup |
| Admission enable | **NO-GO** until Phase C |

---

## 6. Rollback notes

- Code: revert/ship previous revision; leave flag off.
- Schema after Phase C with empty Studio tables: downgrade of `add_business_studio_v1` is allowed only while tables are empty (migration enforces this).
- Never roll back Business / capabilities / knowledge tables as a “fix” for Studio.

---

## 7. Decision summary

| Question | Answer |
| --- | --- |
| Code integration to main | GO (feature commit rebased on identity/scroll fixes) |
| Production migration this window | **NO-GO** |
| Production deploy this window | **NO-GO** (out of scope) |
| Existing Sept dump usable as cutover backup | **NO** (stale vs live Business schema); format OK as tooling proof only |
| Path to future GO | Fresh PG17 dump → inventory → stamp-reconcile to capabilities → upgrade Studio only → then consider admission |
