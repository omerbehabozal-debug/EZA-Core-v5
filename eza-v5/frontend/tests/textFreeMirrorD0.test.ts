/**
 * PR D0 — Text-Free Mirror contract tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import {
  buildMinimalOpenAIRenderPrompt,
  MIRROR_TEXT_FREE_SCENE_RULE,
  MIRROR_V5_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';

const stage0Src = readFileSync(
  join(process.cwd(), 'components/mirror/MirrorStage0MinimalOverlay.tsx'),
  'utf8'
);
const promptSrc = readFileSync(
  join(process.cwd(), 'lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt.ts'),
  'utf8'
);

describe('PR D0 — text-free Mirror image contract', () => {
  it('Stage0 overlay does not paint title onto the scene', () => {
    expect(stage0Src).toContain('data-mirror-stage0-text-free');
    expect(stage0Src).toContain('className="sr-only"');
    expect(stage0Src).toContain('id="daily-mirror-poster-title"');
    expect(stage0Src).not.toMatch(/skin\.rhythmWhisperWord[\s\S]*\{title\}/);
    expect(stage0Src).not.toContain('justify-end pb-6');
  });

  it('Stage0 prompt builder forbids Title may appear / TITLE blocks', () => {
    expect(promptSrc).not.toContain('Title may appear');
    expect(promptSrc).not.toMatch(/TITLE:\\n/);
    expect(promptSrc).toContain('MIRROR_TEXT_FREE_SCENE_RULE');
  });

  it('provider prompt has no-text rules and excludes the title string', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'd0-text-free',
      conversationId: 'd0-text-free',
    });
    const brief = buildMirrorRenderBrief(payload);
    const prompt = buildMinimalOpenAIRenderPrompt(brief);
    const visual = buildVisualPayloadFromMirrorV3(payload);

    expect(brief.title.trim().length).toBeGreaterThan(0);
    expect(visual.hybridTextPayload?.headline).toBe(payload.mirrorTitle);
    expect(visual.masterPosterText?.headline).toBe(payload.mirrorTitle);

    expect(prompt).toContain(MIRROR_TEXT_FREE_SCENE_RULE);
    expect(prompt).toMatch(/no text/i);
    expect(prompt).toMatch(/typography/i);
    expect(prompt).toMatch(/readable signage/i);
    expect(prompt).not.toContain('TITLE:');
    expect(prompt).not.toContain('Title may appear');
    expect(prompt).not.toContain(brief.title);
    expect(prompt).not.toContain(`"${brief.title}"`);

    expect(visual.prompt).toBe(prompt);
    expect(visual.negativePrompt).toBe(MIRROR_V5_NEGATIVE_PROMPT);
    expect(visual.negativePrompt).toMatch(/typography|readable signage|watermark/i);
  });

  it('raw scene display path does not canvas-burn brand/title overlays', () => {
    const v3OverlaySrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay.ts'),
      'utf8'
    );
    const resolveSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/resolveMirrorSceneDisplayUrl.ts'),
      'utf8'
    );
    const resolveFn = v3OverlaySrc.slice(
      v3OverlaySrc.indexOf('export async function resolveV3SceneDisplayUrl')
    );
    expect(resolveFn).toContain('return rawSceneImageUrl');
    expect(resolveFn).not.toContain('applyV3PosterBrandOverlayUrl(rawSceneImageUrl');
    expect(resolveSrc).toContain('PR D0 text-free passthrough');
  });

  it('conversation mirror state keeps title metadata while image prompt stays text-free', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const state = buildMirrorStateV3(scenario.buildEntries(), {
      conversationId: 'd0-state',
      seed: 'd0-state',
    });
    const title = state.dailyMirrorCard.headline;
    const prompt = state.dailyMirrorCard.visual?.prompt ?? '';

    expect(title.trim().length).toBeGreaterThan(0);
    expect(state.dailyMirrorCard.mirrorV3Payload?.mirrorTitle).toBe(title);
    expect(prompt).toContain(MIRROR_TEXT_FREE_SCENE_RULE);
    expect(prompt).not.toContain('TITLE:');
    expect(prompt).not.toContain(title);
  });
});
