# Mirror V6 — Semantic Anchors (Phase 1+)

Status: **active** (meaning core for Curiosity Builder).  
Out of scope: Vision Verify, vision anchors, smart CTA, two-line title UI.

## Goal

Keep conversation, interpretation, landing (and later prompt/image) on **one meaning core**.

```
Conversation (D1 user_stated)
        ↓
Interpretation (D2)
        ↓
Semantic Anchors
        ↓
Curiosity Builder → Public Landing
```

Later (not now):

```
Semantic Anchors → Prompt → Image → Vision Anchors → Anchor Match → Publish
```

## Contract

`mirror-semantic-anchors-v1`

```ts
{
  contractVersion: 'mirror-semantic-anchors-v1',
  place: string | null,
  scene: string[],
  emotion: string[],
  topic: string | null,
  userIntent: string | null,
  decisionCriteria: string[],
  question: string | null,
  anchorsHash: string,
  evidenceCount: number,
}
```

## Rules

- Built deterministically from **D2 interpretation** + **D1 `user_stated` evidence**.
- Never from V3 `seed.subtopics` / internal taxonomy labels.
- Anchors extract **meaning**; they do not write editorial copy (that is Curiosity Builder).
- Sparse anchors are allowed; grounded when `place` / `topic` / `question` exists, or `scene.length >= 2`, or `decisionCriteria.length >= 2`.
- Vision overlap / reject-on-mismatch is **Phase 2+**.

## Code

| Path | Role |
|------|------|
| `frontend/lib/eza/mirror/semanticAnchors/` | types + extractor |
| `frontend/lib/eza/mirror/curiosityBuilder/` | editorial discover card |
| `publicMirrorLanding.ts` | attach anchors; land via Curiosity Builder |

## Tests

`frontend/tests/semanticAnchorsPhase1.test.ts`  
`frontend/tests/curiosityBuilder.test.ts`
