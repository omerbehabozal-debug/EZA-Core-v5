import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  collectIntentCueBlob,
  resolveLockedPrimaryIntent,
  buildIntentLockPromptBlock,
  getIntentLockForbiddenPhrases,
  extractVehicleHighlightLabels,
  extractMirrorCueHintsFromUserText,
} from '@/lib/eza/mirror/intentLockSystem';
import { resolveMirrorIntentContext } from '@/lib/eza/mirror/mirrorIntentContext';
import { deriveConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { composeEditorialHeadline } from '@/lib/eza/mirror/editorialHeadlines';
import { composePrecisionStory } from '@/lib/eza/mirror/reflectionSignals';
import { buildContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import {
  POSTER_PREVIEW_WIDTH_PX,
  POSTER_PREVIEW_HEIGHT_PX,
  POSTER_EXPORT_WIDTH_PX,
  POSTER_EXPORT_HEIGHT_PX,
} from '@/lib/eza/mirror/posterEditorialMathematics';
import { posterCardSkin } from '@/lib/eza/mirror/posterCardSkin';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

function bmwMercedesEntry(intent = 'compare comfort choice'): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `bmw-${Math.random()}`,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 78,
      intent,
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    standaloneObservation: {
      user_pattern: {
        category: 'decision_direction',
        confidence: 0.9,
        signals: ['bmw', 'mercedes', 'konfor', 'uzun yol', 'hangisi', 'tercih'],
      },
      ai_behavior: { category: 'explanatory', confidence: 0.85, signals: ['comparison'] },
      relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: ['karar'] },
    },
  };
}

const BMW_ENTRIES = [
  bmwMercedesEntry('bmw 3 serisi mercedes c serisi konfor karşılaştırma'),
  bmwMercedesEntry('hangisi tercih uzun yol'),
  bmwMercedesEntry('compare comfort sedan'),
];

describe('intentLockSystem (Sprint 12B)', () => {
  it('BMW/Mercedes conversation locks premium_vehicle_comparison', () => {
    const locked = resolveLockedPrimaryIntent({ entries: BMW_ENTRIES });
    expect(locked).toBe('premium_vehicle_comparison');
  });

  it('locked vehicle intent maps to comparison_scene', () => {
    const intent = deriveConversationVisualIntent({
      entries: BMW_ENTRIES,
      topicKey: 'general',
      storyVariant: 'compare',
    });
    expect(intent.id).toBe('premium_vehicle_comparison');
    expect(intent.composition).toBe('comparison_scene');
  });

  it('vehicle lock prompt contains two premium executive sedans', () => {
    const block = buildIntentLockPromptBlock('premium_vehicle_comparison');
    expect(block.toLowerCase()).toContain('two premium executive sedans');
  });

  it('vehicle lock forbids pier seascape dock in negative extras', () => {
    const forbidden = getIntentLockForbiddenPhrases('premium_vehicle_comparison');
    expect(forbidden.join(' ')).toMatch(/pier|seascape|dock/i);
    const visual = buildMirrorVisualFromContext({
      entries: BMW_ENTRIES,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-mercedes-12b',
      storyVariant: 'compare',
      storyTopicKey: 'general',
      reflectionTone: 'calm_reflective',
    });
    const neg = visual.negativePrompt.toLowerCase();
    expect(neg).toContain('pier');
    expect(neg).toContain('seascape');
    const p = visual.prompt.toLowerCase();
    expect(p).toContain('scene contract vehicle_comparison_showroom');
    expect(p).toContain('composition contract opening');
    expect(p).toContain('two premium executive sedans');
    expect(p).toContain('required objects');
    expect(p).not.toContain('empty pier');
    const openingIdx = visual.prompt.indexOf('COMPOSITION CONTRACT OPENING');
    const styleIdx = visual.prompt.indexOf('STYLE CANON');
    expect(openingIdx).toBeGreaterThanOrEqual(0);
    expect(styleIdx).toBeGreaterThan(openingIdx);
  });

  it('metrics layout stays horizontal with min column width', () => {
    expect(posterCardSkin.insightsRow).toContain('grid-cols-3');
    expect(posterCardSkin.insightsRow).toContain('minmax(100px');
    expect(posterCardSkin.insightLine).toContain('line-clamp-2');
    expect(posterCardSkin.insightLine).toContain('horizontal-tb');
  });

  it('poster dimensions remain 432×768 preview and 1080×1920 export', () => {
    expect(POSTER_PREVIEW_WIDTH_PX).toBe(432);
    expect(POSTER_PREVIEW_HEIGHT_PX).toBe(768);
    expect(POSTER_EXPORT_WIDTH_PX).toBe(1080);
    expect(POSTER_EXPORT_HEIGHT_PX).toBe(1920);
  });

  it('vehicle comparison headline avoids calm fallback', () => {
    const headline = composeEditorialHeadline(
      'calm_analysis',
      'default',
      'general',
      'bmw-headline',
      'premium_vehicle_comparison'
    );
    expect(headline).not.toMatch(/Sakin Tempo|Sessiz Netlik/i);
    expect(['Kıyasla ve Netleştir', 'Konforu Seç', 'İki Seçenek, Net Bir Yol', 'Karar Öncesi Netlik']).toContain(
      headline
    );
  });

  it('contextualHighlight uses dual_comparison for vehicle scene', () => {
    const card = {
      storyVariant: 'compare',
      userLine: 'BMW 3 serisi ile Mercedes C serisi arasında konfor öncelikli karar',
      aiLine: 'İki seçeneği yan yana netleştirdi',
      mirrorStory: 'Bugün AI ile iki güçlü seçeneği konfor üzerinden netleştirdin.',
      dailyJourney: 'Konforu Seç',
      visual: { sceneIntentLabel: 'premium car comparison' },
    } as DailyMirrorCardModel;
    const h = buildContextualHighlight(card);
    expect(h.kind).toBe('dual_comparison');
    expect(h.left?.label).toBe('BMW 3 Serisi');
    expect(h.right?.label).toBe('Mercedes C Serisi');
  });

  it('extractMirrorCueHintsFromUserText captures BMW/Mercedes chat keywords', () => {
    const hints = extractMirrorCueHintsFromUserText(
      'BMW 3 Serisi ile Mercedes C arasında konfor için hangisini seçmeliyim?'
    );
    expect(hints).toContain('bmw');
    expect(hints).toContain('mercedes');
    expect(hints).toContain('konfor');
    expect(hints).toContain('hangisi');
  });

  it('mirrorCueHints on entries unlock vehicle intent in live context', () => {
    const entries = BMW_ENTRIES.map((e, i) =>
      i === 0
        ? {
            ...e,
            mirrorCueHints: extractMirrorCueHintsFromUserText(
              'BMW 3 vs Mercedes C konfor uzun yol'
            ),
          }
        : e
    );
    const ctx = resolveMirrorIntentContext({ entries });
    expect(ctx.lockedIntent).toBe('premium_vehicle_comparison');
  });

  it('collectIntentCueBlob surfaces observation signals for lock', () => {
    const blob = collectIntentCueBlob(BMW_ENTRIES);
    expect(blob).toContain('bmw');
    expect(blob).toContain('mercedes');
    expect(blob).toContain('konfor');
  });

  it('extractVehicleHighlightLabels returns brand labels', () => {
    const labels = extractVehicleHighlightLabels('bmw 3 serisi mercedes c serisi konfor');
    expect(labels?.left).toBe('BMW 3 Serisi');
    expect(labels?.right).toBe('Mercedes C Serisi');
  });

  it('composePrecisionStory uses vehicle-specific mirror copy when locked', () => {
    const story = composePrecisionStory(
      'general',
      {
        curiosityDepth: 0.5,
        comparisonIntensity: 0.6,
        reassuranceSeeking: 0.2,
        explorationMode: 0.3,
        calmnessLevel: 0.7,
        decisiveness: 0.5,
        emotionalOpenness: 0.4,
        retryBehavior: 0.1,
        detailFocus: 0.4,
        conversationalEnergy: 0.5,
      },
      'comparing',
      'vehicle-story',
      'premium_vehicle_comparison'
    );
    expect(story.mirrorStory).toContain('konfor');
    expect(story.dailyJourney).not.toMatch(/Sakin Tempo|Sessiz Netlik/i);
  });
});
