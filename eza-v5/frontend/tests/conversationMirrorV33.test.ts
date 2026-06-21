import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import {
  resolveConversationEvidence,
  formatConversationEvidenceBlock,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import {
  buildConversationMirrorV33QualityReport,
  meetsConversationMirrorV33QualityTarget,
  CONVERSATION_MIRROR_V33_TARGET_SCORE,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationMirrorV33Quality';
import {
  MIRROR_REFINEMENT_VERSION,
  MIRROR_V3_SCENE_CACHE_KEY,
} from '@/lib/eza/mirror/conversationMirrorV3/types';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';

const V33_SCENARIO_IDS = [
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

describe('conversationMirrorV33', () => {
  it('bumps refinement version and cache key to 3.3', () => {
    expect(MIRROR_REFINEMENT_VERSION).toBe('3.3');
    expect(MIRROR_V3_SCENE_CACHE_KEY).toBe('conversationMirrorV3:refinement:3.3');
  });

  it('payload includes conversation evidence from active conversation only', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v33-japan',
      conversationId: 'qa-v33-japan',
    });

    expect(payload.refinementVersion).toBe('3.3');
    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    expect(payload.conversationEvidence.length).toBeLessThanOrEqual(6);
    expect(payload.conversationEvidence.every((item) => item.source === 'active_conversation')).toBe(
      true
    );
    expect(payload.conversationEvidence[0]?.role).toBe('primary');
    expect(payload.conversationEvidence.some((item) => item.visualHint.length > 10)).toBe(true);
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

  it('V3.3 prompt follows evidence-first block order', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v33-order',
      conversationId: 'qa-v33-order',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    const posterTask = prompt.indexOf('Create a premium cinematic SAINA');
    const selectedTopic = prompt.indexOf('Selected topic');
    const evidence = prompt.indexOf('Conversation evidence:');
    const topicRule = prompt.indexOf('Topic visibility rule:');
    const mirrorTitle = prompt.indexOf('Mirror title');
    const mirrorCopy = prompt.indexOf('Mirror copy');
    const meaning = prompt.indexOf('Meaning layer');
    const cinematography = prompt.indexOf('Cinematography contract:');
    const typographyDirector = prompt.indexOf('Typography director:');
    const season = prompt.indexOf('Season art direction:');
    const metaphor = prompt.indexOf('Visual metaphor translation (V3.3):');
    const brandSafe = prompt.indexOf('Brand safe zones');
    const avoid = prompt.indexOf('Avoid:');

    expect(posterTask).toBeLessThan(selectedTopic);
    expect(selectedTopic).toBeLessThan(evidence);
    expect(evidence).toBeLessThan(topicRule);
    expect(topicRule).toBeLessThan(mirrorTitle);
    expect(mirrorTitle).toBeLessThan(mirrorCopy);
    expect(mirrorCopy).toBeLessThan(meaning);
    expect(meaning).toBeLessThan(cinematography);
    expect(cinematography).toBeLessThan(typographyDirector);
    expect(typographyDirector).toBeLessThan(season);
    expect(season).toBeLessThan(metaphor);
    expect(metaphor).toBeLessThan(brandSafe);
    expect(brandSafe).toBeLessThan(avoid);

    expect(prompt).toContain('Abstraction limit:');
    expect(prompt).toContain('Scene clarity rule:');
    expect(prompt).toContain('Evidence weight:');
    expect(prompt).toContain('Conversation evidence: 60%');
    expect(prompt).toContain('OpenAI poster text contract:');
  });

  for (const id of V33_SCENARIO_IDS) {
    it(`${id} quality report meets V3.3 targets`, () => {
      const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
      const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
        seed: `qa-v33-${id}`,
        conversationId: `qa-v33-${id}`,
        season: scenario.season,
      });
      const prompt = buildMirrorV3ImagePrompt(payload);
      const report = buildConversationMirrorV33QualityReport(payload, prompt);

      expect(report.selectedTopic).toBeTruthy();
      expect(report.conversationEvidence.length).toBeGreaterThanOrEqual(3);
      expect(report.mirrorTitle).toBeTruthy();
      expect(report.mirrorCopy).toBeTruthy();
      expect(report.generatedPrompt).toContain('Conversation evidence:');

      expect(report.topicVisibilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V33_TARGET_SCORE);
      expect(report.evidenceIntegrationScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V33_TARGET_SCORE);
      expect(report.typographyContractScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V33_TARGET_SCORE);
      expect(report.shareabilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V33_TARGET_SCORE);
      expect(meetsConversationMirrorV33QualityTarget(report)).toBe(true);
    });
  }

  it('multi-topic single chat produces evidence from dominant cues without inventing topics', () => {
    const entries = buildMultiTopicEntries();
    const payload = buildMirrorPayloadV3(entries, {
      seed: 'qa-v33-multi',
      conversationId: 'qa-v33-multi',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);
    const report = buildConversationMirrorV33QualityReport(payload, prompt);

    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    const hintBlob = payload.conversationEvidence.map((item) => item.label).join(' ').toLowerCase();
    expect(hintBlob).toMatch(/japonya|kyoto|tokyo|bmw|mercedes|cephe|mimari|malzeme/);
    expect(report.topicVisibilityScore).toBeGreaterThanOrEqual(CONVERSATION_MIRROR_V33_TARGET_SCORE);
    expect(prompt).toContain('Conversation evidence:');
  });

  it('prompt forbids legacy dashboard and coaching UI blocks', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v33-forbidden',
      conversationId: 'qa-v33-forbidden',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(prompt.toLowerCase()).toContain('bugün görünen desen');
    expect(prompt).toContain('Do not create sections like "Bugün Görünen Desen"');
    expect(prompt).toContain('Forbidden text elements:');
    expect(prompt).toMatch(/Strictly forbidden concepts:[\s\S]*Bugün Görünen Desen/);
    expect(prompt).not.toMatch(/^Bugün Görünen Desen/m);
  });
});
