# Phase 7.4.1 — Strong Curiosity Strategy Selection Contract

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**This phase chooses architecture/roles. It does not activate ranking and does not declare a ranking winner.**

Phase 7.5 limited live experiment remains **NO-GO**.

> Güçlü Merak bir popülerlik listesi değildir.
> Bir Yansı'nın insanlarda merakı sürdürdüğüne ve yeni meraklar
> üretebildiğine dair güvenilir kanıtları görünür kılmayı amaçlar.

## Why there is no weighted score

Rejected, including:

`0.3 * attraction + 0.3 * engagement + 0.4 * generativity`

and any `curiosityScore` / `qualityScore` / `finalScore` / 0–100 normalization.

Reasons:

- experience is `slug + journeyVersion`; children/generativity are slug-level
- denominators and sample sizes are not interchangeable
- historical gaps leave rates legitimately `null`
- guest unique-human evidence is `UNAVAILABLE`
- weights would imply false precision across incompatible scopes

The policy is layered **roles**, not an average of strategies.

## Strategy roles (role selection ≠ ranking winner)

Frozen Phase 7.3 comparators were checked against Phase 7.4 findings. The recommended roles **match** that evidence. No comparator was rewritten.

| Strategy | Role | Why |
|---|---|---|
| `balanced_evidence` | **FOUNDATION** (candidate, not winner) | Multi-family lexicographic; start volume last; 7.4 `PROVEN RESISTANT` |
| `generativity_led` | **REPRESENTATION** | Distinctive biligN lens: external propagation / author diversity, not `children DESC`; 7.4 `PROVEN RESISTANT`. Must **not** always put generative rows first. |
| `evidence_stability` | **CONFIDENCE** | Answers “how much support for this evidence?” Unique auth + ranking-eligible sample. 7.4 `PARTIAL`; not a sole ranker. |
| `engagement_led` | **DIAGNOSTIC** | 7.4 `DEPENDENT` + `HIGH_MONOTONIC_DEPENDENCE`. Frozen. `INELIGIBLE_AS_SOLE_LIVE_RANKER`. Not deleted. |
| `control_input_order` | **CONTROL** | Evaluation reference only. Never live Güçlü Merak. |

`balanced_evidence` is the current **foundation candidate**. It must still be challenged in 7.4.2 by generativity representation, historical/newness, guest repeats, and large-corpus behavior.

## Layered contract (not averaging)

A. Phase 7.2 candidate pool only — eligibility unchanged.  
B. `balanced_evidence` as general evidence-aware foundation.  
C. `generativity_led` as representation/diversity lens so volume/engagement cannot systematically bury credible external generativity. **No 30% quota** in 7.4.1; that test belongs to 7.4.2.  
D. `evidence_stability` as confidence/tie/context only — do not penalize guests for missing uniqueness; do not boost authenticated creators.  
E. `engagement_led` stays diagnostic.

## Three-mode product separation

| Mode | Purpose | Strong Curiosity signals |
|---|---|---|
| **Rastlantısal** (`random`, **default**) | Serendipity / equal opportunity among eligible Yansılar | No |
| **En Yeni** (`newest`) | Temporal discovery | No |
| **Güçlü Merak** (`strong_curiosity`) | Evidence-informed curiosity holding and/or propagating — when later activated | Yes, via this contract. **Currently placeholder.** |

Default Discover remains Rastlantısal. Unchanged in this phase.

## Historical / new / guest / scope / age / skip / selectedCount

- Historical: keep; no fake zero engagement; no fake conversion; no auto-promote; retain `HISTORICAL_ONLY` / gap.
- New / evidence-poor: `INSUFFICIENT_EVIDENCE`, **not** low quality. Rastlantısal + En Yeni remain the discovery path. No freshness boost inside Güçlü Merak.
- Guest uniqueness: `UNAVAILABLE`. No fingerprint / IP / UA. Known blind spot, not silently ignored.
- Scope: experience version-scoped; children slug-level; carry `SCOPE_INCOMPATIBLE`; no versioned child attribution.
- Age: diagnostic only. No decay / boost / penalty.
- `selectedCount` 6/7/8: context only. No completion correction.
- Skip: navigational branching. No penalty.

## Forbidden inputs

EZA scores, Relationship Map, assistant/user scores, followers, profile views, creator totals, reputation, account age, paid status, embeddings, collaborative filtering, viewer personalization.

## Phase 7.4.2 readiness (unproven here)

7.4.2 must evaluate the **combined/layered** policy against:

1. raw popularity resistance  
2. generativity representation  
3. small-sample safety  
4. self-play invariance  
5. auth concentration  
6. historical/newness asymmetry  
7. guest limitation disclosure  
8. deterministic ordering  
9. mode isolation  
10. corpus-scale behavior  

Phase 7.4 tests do **not** mark these passed for the combined policy.

## Phase 7.5

**NO-GO.** Roles are assigned; live quality is not proven; Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`  
UI: *Güçlü Merak henüz hazır değil.*
