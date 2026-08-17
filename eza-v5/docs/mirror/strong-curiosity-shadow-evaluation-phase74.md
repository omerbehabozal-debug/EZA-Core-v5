# Phase 7.4 — Strong Curiosity Shadow Evaluation

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**Phase 7.4 evaluates ranking behavior. It does not activate ranking.**

Live Discover remains:

| Mode | UI | Behavior |
|---|---|---|
| `random` | Rastlantısal | Unchanged HMAC seeded permutation |
| `newest` | En Yeni | Unchanged `published_at DESC`, `slug ASC` |
| `strong_curiosity` | Güçlü Merak | Placeholder. `items=[]`, `strongCuriosityReady=false`. Copy: *Güçlü Merak henüz hazır değil.* |

`list_discover_mirrors` does **not** import this module.

## What was evaluated

Phase 7.3 shadow strategies, **unchanged**:

| Internal id | Semantic keys (frozen) |
|---|---|
| `control_input_order` | input order, then slug ASC |
| `balanced_evidence` | available family count → historical generativity → distinct external authors → external children → engagement status → log1p(ranking-eligible completion den) → ranking-eligible completion ratio → unique auth excluding author → log1p(ranking-eligible starts) **last** → slug ASC |
| `generativity_led` | generativity status → distinct external authors → external children → ranking-eligible continuations → scope-compatible publication rate only → slug ASC |
| `engagement_led` | engagement status → log1p(ranking-eligible started den) → ranking-eligible completion ratio **after** sample support → log1p(completed) → slug ASC. Skip ignored. |
| `evidence_stability` | unique-auth present → log1p(unique auth excluding author) → log1p(ranking-eligible sample) → slug ASC |

There is still no `0.3*A + 0.3*E + 0.4*G`. Evaluation does **not** rewrite these comparators. Weaknesses are findings.

The 0.90 monotonic-agreement flag is an **engineering warning**, not a quality threshold.

## Reference cohorts

Controlled synthetic pathologies (A–O plus small-sample series):

| Id | Slug | Point |
|---|---|---|
| A | `mass-popularity` | 100k ranking-eligible starts, 70k completions, 0 external children |
| B | `small-generative` | 200 starts / 130 completions / 12 external children / 9 authors |
| C | `tiny-perfect` | 2/2, 0 children |
| D | `self-play-heavy` | public 500 / ranking-eligible 50 / author self 450 |
| E | `child-self-farm` vs `external-diversity` | 20 mostly-self vs 8 mostly-external |
| F | `auth-concentrated` vs `auth-diverse` | 100 sessions / 1 account vs 70 accounts |
| G | `historical-yansi` | 10 external children, 0 Phase 6 starts, rates null |
| H | `new-yansi` | recent, zero evidence, `INSUFFICIENT_EVIDENCE`, not labelled bad |
| I | `old-high-volume` | age-accumulated starts, little generativity |
| J | `skip-and-complete` | skip present; skip is not a penalty |
| K | `replay-length-six` / `eight` | selectedCount diagnostic only |
| L | `scope-incompatible` | v2 starts + slug children, no versioned conversion |
| M | engagement without generativity | |
| N | generativity without strong engagement | |
| O | `balanced-reference` | mixed families, not a hard-coded winner |

## Observed strategy behaviour (reference cohort)

These are cohort findings, not a product winner.

**control_input_order** — reference only. Not curiosity. `rawPopularityDominance = NOT ENOUGH EVIDENCE`.

**balanced_evidence** — `PROVEN RESISTANT` on this cohort: small-generative rises above mass-popularity (family coverage). Tiny 2/2 does not beat 7000/10000. External diversity beats self-farm. Start volume is last. Guest uniqueness still unavailable.

**generativity_led** — `PROVEN RESISTANT` to start-volume on this cohort. External author diversity beats raw child count. Weaker engagement representation. Historical children can still appear.

**engagement_led** — sample support prevents tiny-perfect rate dominance, and therefore **tracks ranking-eligible start volume**. On the reference cohort mass-popularity leads this strategy (`DEPENDENT`). Weak generativity. Top-K is engagement-dominated.

**evidence_stability** — unique-auth concentration is visible (1 account vs 70). `PARTIAL` raw-popularity verdict: sample size is a key. Unsuitable as sole curiosity order. Guest humans are not invented.

No automatic `WINNER = …`. `recommendedLiveStrategy = null`. `limitedLiveExperiment = NO-GO` until an explicit later product choice.

## Popularity dependence

Per strategy, pairwise concordance vs:

- public started count
- ranking-eligible started count
- raw `directChildYansiCount`
- `externalDirectChildYansiCount`
- `distinctExternalChildAuthorCount`
- `ageDays`

`HIGH_MONOTONIC_DEPENDENCE` at agreement ≥ 0.90 is a warning, not a ranking input.

## Small-sample / self-play / diversity

- `2/2` does not outrank `7000/10000` on engagement-aware strategies merely because 1.0 > 0.70.
- Author self-sessions with ranking-eligible held fixed do not improve ranking-strategy positions.
- 20 mostly-self children lose to 8 mostly-external children under `generativity_led`.

## Historical / newness / guests / age

Asymmetric measurement is reported, not hidden.

- Historical: rates stay null. Not quality-zero.
- New: evidence-poor, not “weak/bad”. Not in the 7.2 pool.
- No age decay, no freshness boost. Age-only perturbation does not change order.
- Guest unique-human remains `UNAVAILABLE`. Ranking-eligible session volume may still include guest repeats. No fingerprint / IP / UA identity.

## Remaining blockers for live ranking

- No strategy is selected as the live order
- `engagement_led` is sample-volume prone
- Guest uniqueness unavailable
- Corpus still bounded at 10k Discover-eligible roots
- Live Güçlü Merak must stay placeholder

## Phase 7.5

A limited live experiment is **NO-GO** from this evaluation. 7.5 would require an explicit product decision, still without a composite score, and without treating evaluation diagnostics as user-facing ranks.
