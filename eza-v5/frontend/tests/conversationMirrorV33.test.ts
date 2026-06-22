import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import {
  resolveConversationEvidence,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import {
  buildConversationMirrorV4QualityReport,
  meetsConversationMirrorV4QualityTarget,
  shouldRegeneratePromptForTopicVisibility,
  CONVERSATION_MIRROR_V4_TARGET_SCORE,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationMirrorV33Quality';
import {
  MIRROR_REFINEMENT_VERSION,
  MIRROR_V3_SCENE_CACHE_KEY,
} from '@/lib/eza/mirror/conversationMirrorV3/types';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';

const V4_SCENARIO_IDS = [
  'japan-travel',
  'architecture-facade',
  'ai-trust',
  'toothpaste-choice',
  'bmw-mercedes',
] as const;

function entry(id: string, hints: string[]): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
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
  };
}

function buildMultiTopicEntries(): SavedBehavioralEntry[] {
  return [
    entry('multi-1', ['japonya', 'tokyo', 'kyoto']),
    entry('multi-2', ['bmw', 'mercedes', 'compare']),
    entry('multi-3', ['architecture', 'facade', 'material']),
  ];
}

describe('conversationMirrorV4', () => {
  it('bumps refinement version and cache key to 5.0', () => {
    expect(MIRROR_REFINEMENT_VERSION).toBe('5.0');
    expect(MIRROR_V3_SCENE_CACHE_KEY).toBe('conversationMirrorV3:refinement:5.0');
  });

  it('payload includes conversation evidence and scene composition', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v4-japan',
      conversationId: 'qa-v4-japan',
    });

    expect(payload.refinementVersion).toBe('5.0');
    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    expect(payload.conversationEvidence.length).toBeLessThanOrEqual(7);
    expect(payload.conversationEvidence.every((item) => item.source === 'active_conversation')).toBe(
      true
    );
    expect(payload.conversationEvidence[0]?.role).toBe('primary');
    expect(payload.sceneComposition.heroScene.length).toBeGreaterThan(20);
    expect(payload.sceneComposition.evidenceFusionScene.length).toBeGreaterThan(40);
    expect(payload.sceneComposition.worldLayer.length).toBeGreaterThan(40);
    expect(payload.sceneComposition.supportingClues.length).toBeGreaterThanOrEqual(1);
  });

  it('japan evidence includes Kyoto/Gion and route planning traces', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const evidence = resolveConversationEvidence({
      entries: scenario.buildEntries(),
      storyTopicId: 'travel',
      selectedTopic: 'Japonya seyahati',
    });

    const labels = evidence.map((item) => item.label.toLowerCase()).join(' ');
    expect(labels).toMatch(/kyoto|gion|japonya|tokyo/);
    expect(evidence.some((item) => /lantern|route|notebook|map|ticket/i.test(item.visualHint))).toBe(
      true
    );
  });

  it('legacy V4.5 prompt builder still includes evidence fusion (not sent to OpenAI in V5)', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v44-order',
      conversationId: 'qa-v44-order',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    const posterTask = prompt.indexOf('Create a premium cinematic SAINA');
    const topic = prompt.indexOf('Topic:');
    const fusion = prompt.indexOf('Evidence fusion scene');
    const posterTest = prompt.indexOf('Poster test:');
    const mirrorTitle = prompt.indexOf('Mirror title');
    const visualStyle = prompt.indexOf('Visual style:');
    const typography = prompt.indexOf('Typography (10%)');

    expect(posterTask).toBeLessThan(topic);
    expect(topic).toBeLessThan(fusion);
    expect(fusion).toBeLessThan(posterTest);
    expect(posterTest).toBeLessThan(mirrorTitle);
    expect(mirrorTitle).toBeLessThan(visualStyle);
    expect(visualStyle).toBeLessThan(typography);

    expect(prompt).toContain('Evidence fusion scene (70%');
    expect(prompt).toContain('World Layer:');
    expect(prompt).toContain('Unified frame rule:');
    expect(prompt).toContain('Fusion rule:');
    expect(prompt).not.toContain('Conversation evidence (20%)');
    expect(prompt).not.toContain('Supporting evidence');
    expect(prompt).not.toMatch(/^-\s+Kyoto/m);
    expect(prompt).not.toContain('Narrative theme:');
    expect(prompt).not.toContain('Meaning:');
    expect(prompt).not.toContain('Emotion:');
  });

  for (const id of V4_SCENARIO_IDS) {
    it(`${id} quality report meets V4 targets (topic visibility ≥ ${CONVERSATION_MIRROR_V4_TARGET_SCORE})`, () => {
      const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
      const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
        seed: `qa-v4-${id}`,
        conversationId: `qa-v4-${id}`,
        season: scenario.season,
      });
      const prompt = buildMirrorV3ImagePrompt(payload);
      const report = buildConversationMirrorV4QualityReport(payload, prompt);

      expect(report.selectedTopic).toBeTruthy();
      expect(report.conversationEvidence.length).toBeGreaterThanOrEqual(3);
      expect(report.heroScene).toBeTruthy();
      expect(report.mirrorTitle).toBeTruthy();
      expect(report.mirrorCopy).toBeTruthy();
      expect(report.generatedPrompt).toContain('Evidence fusion scene');

      expect(report.topicVisibilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(report.evidenceIntegrationScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(report.heroSceneScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(report.sceneSpecificityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(report.typographyContractScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(report.shareabilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
      expect(meetsConversationMirrorV4QualityTarget(report)).toBe(true);
      expect(shouldRegeneratePromptForTopicVisibility(report)).toBe(false);
    });
  }

  it('multi-topic single chat produces evidence from dominant cues without inventing topics', () => {
    const entries = buildMultiTopicEntries();
    const payload = buildMirrorPayloadV3(entries, {
      seed: 'qa-v4-multi',
      conversationId: 'qa-v4-multi',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);
    const report = buildConversationMirrorV4QualityReport(payload, prompt);

    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    const hintBlob = payload.conversationEvidence.map((item) => item.label).join(' ').toLowerCase();
    expect(hintBlob).toMatch(/japonya|kyoto|tokyo|bmw|mercedes|cephe|mimari|malzeme/);
    expect(report.topicVisibilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V4_TARGET_SCORE);
    expect(prompt).toContain('Evidence fusion scene');
  });

  it('prompt forbids legacy dashboard and coaching UI blocks', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v4-forbidden',
      conversationId: 'qa-v4-forbidden',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(prompt).toContain('Forbidden text/UI');
    expect(prompt.toLowerCase()).toContain('bugün görünen desen');
    expect(prompt).not.toMatch(/^Bugün Görünen Desen/m);
  });
});
