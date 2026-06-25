import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import {
  buildMinimalOpenAIRenderPrompt,
  buildOpenAIRenderPromptFromPayload,
} from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import { buildMirrorV5RenderDebugTrace } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorV5DebugTrace';
import type { MirrorLightMode } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { MIRROR_V5_MAX_RENDER_PROMPT_CHARS, MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { auditMirrorProviderPrompt } from '@/lib/eza/mirror/conversationMirrorV3/mirrorProviderPromptBuilder';
import { buildVisualPayloadFromMirrorV3 } from '@/lib/eza/mirror/conversationMirrorV3/visualPayloadAdapterV3';
import { auditMirrorImagePromptLeakage } from '@/lib/eza/mirror-network/auditImagePrompt';
import { buildMirrorCuriosityBundle } from '@/lib/eza/mirror-network/buildMirrorCuriosity';

function thyroidEntry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'thyroid-qa',
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    mirrorCueHints: ['guatr', 'thyroid', 'tiroid', 'boyun', 'health'],
    vector: {
      input_risk: 0.22,
      output_risk: 0.18,
      input_health: 0.78,
      output_health: 0.82,
      alignment_score: 84,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.04, index: 0.08 },
  };
}

function uzbekTrainEntries(): SavedBehavioralEntry[] {
  const base = Date.now();
  const mk = (id: string, i: number, hints: string[]): SavedBehavioralEntry => ({
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date(base - i * 3600000).toISOString(),
    mirrorCueHints: hints,
    vector: {
      input_risk: 0.22,
      output_risk: 0.18,
      input_health: 0.78,
      output_health: 0.82,
      alignment_score: 84,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.04, risk_delta_output_minus_input: -0.04, index: 0.08 },
  });
  return [
    mk('uz-1', 0, ['uzbekistan', 'train', 'tren', 'samarkand', 'route']),
    mk('uz-2', 1, ['rail', 'journey', 'central asia', 'travel']),
    mk('uz-3', 2, ['ticket', 'rota', 'curious']),
  ];
}

type V5Scenario = {
  id: string;
  label: string;
  buildEntries: () => SavedBehavioralEntry[];
  expectedLightMode: MirrorLightMode;
  expectedSafety?: 'normal' | 'abstract_safe';
  topicHintPattern?: RegExp;
};

const V5_SCENARIOS: V5Scenario[] = [
  {
    id: 'japan-travel',
    label: 'Japonya seyahati',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!.buildEntries(),
    expectedLightMode: 'quiet_luxury_evening',
    topicHintPattern: /japan travel/i,
  },
  {
    id: 'thyroid-health',
    label: 'Guatr / thyroid health',
    buildEntries: () => [thyroidEntry()],
    expectedLightMode: 'clean_health_daylight',
    expectedSafety: 'abstract_safe',
    topicHintPattern: /thyroid health/i,
  },
  {
    id: 'architecture-facade',
    label: 'Mimari cephe',
    buildEntries: () =>
      MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!.buildEntries(),
    expectedLightMode: 'soft_architectural_daylight',
    topicHintPattern: /architecture material/i,
  },
  {
    id: 'bmw-mercedes',
    label: 'BMW vs Mercedes',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'bmw-mercedes')!.buildEntries(),
    expectedLightMode: 'golden_hour_road',
    topicHintPattern: /car comparison/i,
  },
  {
    id: 'ai-trust',
    label: 'Yapay zeka güveni',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'ai-trust')!.buildEntries(),
    expectedLightMode: 'modern_technology_light',
    topicHintPattern: /ai trust/i,
  },
  {
    id: 'spirituality',
    label: 'Maneviyat',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'spirituality')!.buildEntries(),
    expectedLightMode: 'contemplative_morning',
    topicHintPattern: /spiritual reflection/i,
  },
  {
    id: 'uzbekistan-train',
    label: 'Özbekistan tren rotası',
    buildEntries: uzbekTrainEntries,
    expectedLightMode: 'golden_hour_travel',
    topicHintPattern: /uzbekistan train/i,
  },
  {
    id: 'product-idea',
    label: 'Ürün fikri',
    buildEntries: () => MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'shopping-choice')!.buildEntries(),
    expectedLightMode: 'premium_editorial_daylight',
    topicHintPattern: /product/i,
  },
];

function assertV5PromptClean(prompt: string, payloadBody: string): void {
  expect(prompt.length).toBeLessThanOrEqual(MIRROR_V5_MAX_RENDER_PROMPT_CHARS);
  expect(prompt.length).toBeGreaterThanOrEqual(180);
  expect(prompt.toLowerCase()).not.toMatch(/\bcinematic\b/);
  expect(prompt).toContain('Create a premium editorial SAINA Mirror poster');
  expect(prompt).not.toContain('Evidence fusion scene');
  expect(prompt).not.toContain('World Layer:');
  expect(prompt).not.toContain('conversation summary');
  expect(prompt).not.toContain('Bugün şunu konuştun');
  expect(prompt).not.toContain(payloadBody);
  expect(prompt).not.toMatch(/^-\s+\S+/m);
}

describe('conversationMirrorV5 render layer', () => {
  for (const scenario of V5_SCENARIOS) {
    it(`${scenario.label} — brief + minimal OpenAI prompt`, () => {
      const entries = scenario.buildEntries();
      const payload = buildMirrorPayloadV3(entries, {
        seed: `qa-v5-${scenario.id}`,
        conversationId: `qa-v5-${scenario.id}`,
      });
      const brief = buildMirrorRenderBrief(payload);
      const { prompt, promptLength, withinLimit } = buildOpenAIRenderPromptFromPayload(brief);
      const trace = buildMirrorV5RenderDebugTrace(payload);

      expect(brief.title).toBeTruthy();
      expect(brief.topicCategory).toBeTruthy();
      expect(brief.publicTopicHint.split(/\s+/).length).toBeLessThanOrEqual(6);
      expect(brief.visualDirection.length).toBeLessThan(200);
      expect(brief.lightMode).toBe(scenario.expectedLightMode);
      if (scenario.expectedSafety) {
        expect(brief.safetyMode).toBe(scenario.expectedSafety);
      }
      if (scenario.topicHintPattern) {
        expect(brief.publicTopicHint).toMatch(scenario.topicHintPattern);
      }
      expect(brief.showSubtitleOnPoster).toBe(false);

      assertV5PromptClean(prompt, payload.mirrorText);
      expect(withinLimit).toBe(true);
      expect(promptLength).toBe(prompt.length);

      expect(trace.render.rawConversationSent).toBe(false);
      expect(trace.render.fullSummarySent).toBe(false);
      expect(trace.render.evidenceListSent).toBe(false);
      expect(trace.render.seedQuestionsSent).toBe(false);
      expect(trace.render.bodyOnPoster).toBe(false);
      expect(trace.stage0.philosophy.passed).toBe(true);
      expect(trace.stage0.coreCuriosity.length).toBeGreaterThan(8);
      expect(trace.stage0.promptLeakage.curiosityContextInPrompt).toBe(false);
      expect(trace.stage0.promptLeakage.seedQuestionsInPrompt).toBe(false);
      expect(trace.stage0.promptLeakage.topicHintInPrompt).toBe(false);
      expect(trace.render.promptSameAsFrontend).toBe(true);
      expect(trace.render.backendAppendApplied).toBe(false);
      expect(trace.render.containsLegacyAvoid).toBe(false);
      expect(trace.render.containsQualityBlock).toBe(false);
      expect(trace.render.containsStyleBlock).toBe(false);
      expect(trace.intelligence.evidenceLabels.length).toBeGreaterThanOrEqual(0);
    });
  }

  it('visual payload sends V5 prompt contract and provider prompt matches frontend', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v5-contract',
      conversationId: 'qa-v5-contract',
    });
    const visual = buildVisualPayloadFromMirrorV3(payload);
    const audit = auditMirrorProviderPrompt(visual);

    expect(visual.promptContract).toBe(MIRROR_V5_PROMPT_CONTRACT);
    expect(visual.qualityHints).toEqual([]);
    expect(audit.promptSameAsFrontend).toBe(true);
    expect(audit.backendAppendedSections).toEqual([]);
    expect(audit.containsLegacyAvoid).toBe(false);
  });

  it('health thyroid provider prompt has no legacy append', () => {
    const payload = buildMirrorPayloadV3([thyroidEntry()], {
      seed: 'qa-v5-thyroid-provider',
      conversationId: 'qa-v5-thyroid-provider',
    });
    const visual = buildVisualPayloadFromMirrorV3(payload);
    const audit = auditMirrorProviderPrompt(visual);

    expect(audit.promptSameAsFrontend).toBe(true);
    expect(audit.backendAppendApplied).toBe(false);
    expect(audit.backendProviderPrompt).toMatch(/never alarming|Thyroid health/i);
  });

  it('health thyroid prompt uses abstract_safe safety language', () => {
    const payload = buildMirrorPayloadV3([thyroidEntry()], {
      seed: 'qa-v5-thyroid-safety',
      conversationId: 'qa-v5-thyroid-safety',
    });
    const brief = buildMirrorRenderBrief(payload);
    const prompt = buildMinimalOpenAIRenderPrompt(brief);

    expect(brief.safetyMode).toBe('abstract_safe');
    expect(prompt).toMatch(/clinical diagnosis|never alarming|never clinical/i);
    expect(prompt).toContain('Clean calm health editorial');
  });

  it('curiosityContext and seed questions stay out of image prompt', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v5-stage0-leak',
      conversationId: 'qa-v5-stage0-leak',
    });
    const brief = buildMirrorRenderBrief(payload);
    const bundle = payload.curiosityBundle ?? buildMirrorCuriosityBundle(payload);
    const { prompt } = buildOpenAIRenderPromptFromPayload(brief);
    const leakage = auditMirrorImagePromptLeakage(prompt, payload, brief, bundle);

    expect(bundle.curiosityContext.text.length).toBeGreaterThan(10);
    expect(bundle.coreCuriosity.length).toBeGreaterThan(10);
    expect(bundle.seedQuestions.length).toBeGreaterThan(0);
    expect(leakage.passed).toBe(true);
    expect(prompt).not.toContain(bundle.curiosityContext.text);
    expect(prompt).not.toContain(bundle.coreCuriosity);
    for (const q of bundle.seedQuestions) {
      expect(prompt).not.toContain(q);
    }
  });

  it('visual payload hybrid text is title-only (no mirror body)', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v5-hybrid-title',
      conversationId: 'qa-v5-hybrid-title',
    });
    const visual = buildVisualPayloadFromMirrorV3(payload);

    expect(visual.hybridTextPayload?.description).toBe('');
    expect(visual.hybridTextPayload?.themeDescription).toBe('');
    expect(visual.hybridTextPayload?.quote).toBe('');
    expect(visual.masterPosterText?.quote).toBe('');
    expect(visual.hybridTextPayload?.headline).toBe(payload.mirrorTitle);
  });

  it('publicTopicHint stays short — no conversation dump', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v5-hint-short',
      conversationId: 'qa-v5-hint-short',
    });
    const brief = buildMirrorRenderBrief(payload);

    expect(brief.publicTopicHint.length).toBeLessThan(60);
    expect(brief.publicTopicHint).not.toMatch(/kyoto.*gion|notebook|train ticket/i);
  });
});
