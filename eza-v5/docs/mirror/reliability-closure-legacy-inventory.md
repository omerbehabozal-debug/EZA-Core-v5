# Reliability Closure — LEGACY_V3 inventory

Intentional remaining `LEGACY_V3` call sites after Mirror Reliability Closure.
`LEGACY_V3` is **never inferred** from missing data; only an explicit discriminator
skips D2 fail-closed asserts.

## Frontend

| Location | Why intentional |
|----------|-----------------|
| `components/standalone/StandaloneObservationExperience.tsx` | `generationPipeline: conversationId ? 'D2_V5' : 'LEGACY_V3'` — Daily / no-conversation path has no D2 prepare; must be **explicit**. |
| `lib/eza/mirror/generateSceneApi.ts` | Request/options types accept `'D2_V5' \| 'LEGACY_V3'` for the wire discriminator. |
| `lib/eza/mirror/d2SceneGenerationGuard.ts` | `resolveGenerationPipeline` returns `LEGACY_V3` **only** when `explicit === 'LEGACY_V3'`; default is `D2_V5`. |
| `lib/eza/mirror/runFailClosedMirrorSceneGeneration.ts` | Allows LEGACY/SHADOW prepare modes **only** when `input.generationPipeline === 'LEGACY_V3'`; D2_V5 never demotes. |
| `tests/d2FailClosedSceneGeneration.test.ts` | Explicit LEGACY_V3 success + D2_V5 demotion-rejection cases. |

## Backend

| Location | Why intentional |
|----------|-----------------|
| `core/schemas/mirror_scene.py` | Optional `generationPipeline: D2_V5 \| LEGACY_V3`. |
| `services/mirror/mirror_scene_prompt_guard.py` | Skips D2 asserts **only** for explicit `LEGACY_V3`; missing/unknown → D2 fail-closed. |
| `services/mirror/mirror_image_service.py` | Passes pipeline through; rejects invalid values. |
| `tests/test_mirror_d2_prompt_guard.py` | Explicit LEGACY allows CATEGORY; missing pipeline fail-closed. |
| `tests/test_mirror_generate_scene.py` / `test_mirror_openai_provider.py` / `test_mirror_entitlement.py` | Fixture bodies may set explicit `LEGACY_V3` for non-D2 paths. |

## Not allowed

- Inferring LEGACY from prepare `directorMode: LEGACY|SHADOW` while caller required `D2_V5`.
- Skipping provider asserts when `generationPipeline` is missing/empty/unknown.
- Soft-continuing conversation Mirror create to V3 CATEGORY prompts after prepare failure.

## Out of scope (this sprint)

- Semantic Anchors
- Vision Verify
