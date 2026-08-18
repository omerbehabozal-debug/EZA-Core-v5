# Phase 7.4.3c — Author concentration diagnosis

Internal only. Product language: **biligN**.

**Diagnostic only.** This phase does not change Phase 7.4.2, 7.3, 7.4.3, or 7.4.3a. It does not add author quotas, penalties, boosts, or creator-popularity ranking. Live Güçlü Merak remains a placeholder.

## Question

Phase 7.4.3b reported top-10 author concentration FAIL (`distinctAuthorCount=2`, `topAuthorShare=0.50`, max 5). Was that:

- A. fixture author assignment
- B. frozen Strong Curiosity policy
- C. both

## Baseline mapping (7.4.3a, unchanged)

```text
archetype = ARCHETYPE_CYCLE[index % 24]
handle    = AUTHOR_HANDLES[index % 24]
# plus alice override for mass / old_high_volume when index % 3 == 0
```

`ARCHETYPE_CYCLE` and `AUTHOR_HANDLES` are both length 24, so each archetype is pinned to one fixture author. High-ranking families (`small_generative` → bob, `external_diversity` → judy) therefore share creator identity by construction.

## Experiments

In-memory only. The persisted `p743a-*` corpus is not rewritten.

| ID | Mapping | Evidence |
|---|---|---|
| A | original 7.4.3a authors | frozen candidate snapshot |
| B | balanced round-robin after archetype interleave | owner-label, then full child semantics |
| C | deterministic `author-map-v1`…`v5` shuffles | owner-label, then full child semantics |

**OWNER-LABEL ONLY** remaps creator labels used for concentration metrics. Ranking evidence stays identical. If final order changes, creator identity leaked into ranking.

**FULL AUTHOR SEMANTICS** keeps child authors fixed and recomputes self vs external child counts under the remapped parent (`derive_child_diversity`). Ordering may change only from that evidence.

## How to run

```bash
python -m backend.scripts.diagnose_strong_curiosity_author_concentration
```

Read-only. Non-production guard. Artifacts go to gitignored `backend/data/internal_shadow_eval/`. Do not commit them.

## Isolation

`list_discover_mirrors` must not import this module. Rastlantısal remains default. En Yeni remains `published_at` chronology. Güçlü Merak remains `items=[]`, `total=0`, `strongCuriosityReady=false`.
