# Mirror V6 — Curiosity Builder

Status: **active** (Semantic Anchors → Curiosity Builder → Public Landing).  
Out of scope: Vision Verify, vision anchors.

## Goal

Landing answers:

> **"Bu sohbete neden girmeliyim?"**

Not a chat summary, blog blurb, AI report, or category label.

```
D2 Interpretation + D1 user_stated
        ↓
Semantic Anchors
        ↓
Curiosity Builder  →  publicTitle / publicSummary / continuationContext
        ↓
Click Test (one retry)
        ↓
Public Landing
```

## Inputs (allowed)

- D2 interpretation fields (title, summary, imageIntent, atmosphere — sparingly)
- Semantic Anchors: `place`, `scene`, `emotion`, `topic`, `userIntent`, `decisionCriteria`, `question`

## Forbidden inputs

- V3 curiosity / storyTension / shortInsight
- CATEGORY / cluster / taxonomy labels
- headline fallback
- storySummary

## Click Test

After generation, ask:

> If I saw this on Keşfet, would I enter?

Fail on blog titles, AI openings (`This conversation…`), forbidden report language, missing click hook.  
On fail → regenerate once with alternate editorial variant.

## Code

| Path | Role |
|------|------|
| `frontend/lib/eza/mirror/curiosityBuilder/` | builder + click test |
| `frontend/lib/eza/mirror/semanticAnchors/` | meaning core (expanded) |
| `publicMirrorLanding.ts` | wires Curiosity Builder into landing |

## Tests

- `frontend/tests/curiosityBuilder.test.ts`
- `frontend/tests/semanticAnchorsPhase1.test.ts`
