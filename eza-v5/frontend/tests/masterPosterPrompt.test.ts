import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { resolveLockedPrimaryIntent } from '@/lib/eza/mirror/intentLockSystem';
import { buildMasterPosterText } from '@/lib/eza/mirror/buildMasterPosterText';
import { resolveSceneSubtopics } from '@/lib/eza/mirror/sceneSubtopicResolver';
import { MASTER_POSTER_TEXT_RULES } from '@/lib/eza/mirror/masterPosterPromptBlock';

function entry(mirrorCueHints: string[]): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `id-${Math.random()}`,
    mode: 'standalone',
    savedAt: '2026-06-07T12:00:00.000Z',
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 80,
      eza_final: 75,
      intent: '',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    mirrorCueHints,
  };
}

describe('master poster prompt integration', () => {
  it('travel silk road prompt includes scene keywords', () => {
    const entries = [
      entry(['özbekistan', 'semerkant', 'buhara']),
      entry(['rota']),
      entry(['seyahat']),
    ];
    const visual = buildMirrorVisualFromContext({
      entries,
      characterName: 'Yolcu',
      personaFamilyId: 'balanced_calm',
      seed: 'silk-road-test',
      dailyJourney: 'İpek Yolu Keşfi',
      cardQuote: 'Mavi çiniler bugünün sohbetini taşıdı.',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toContain('samarkand');
    expect(p).toContain('registan');
    expect(p).toContain('blue_tiles');
    expect(p).toContain('silk_road');
    expect(visual.sceneSubtopicId).toBe('travel_silk_road');
  });

  it('prompt includes VISIBLE POSTER TEXT with exact headline and quote', () => {
    const subtopic = resolveSceneSubtopics('travel', ['semerkant']);
    const master = buildMasterPosterText({
      dailyJourney: 'Semerkant Rotası',
      quote: 'Registan ışığında küçük bir keşif.',
      sceneSubtopicResolution: subtopic,
    });
    const visual = buildMirrorVisualFromContext({
      entries: [entry(['semerkant'])],
      characterName: 'Yolcu',
      personaFamilyId: 'balanced_calm',
      seed: 'poster-text-test',
      masterPosterText: master,
      sceneSubtopicResolution: subtopic,
    });
    expect(visual.prompt).toContain('VISIBLE POSTER TEXT');
    expect(visual.prompt).toContain(`Headline: ${master.headline}`);
    expect(visual.prompt).toContain(`Quote: ${master.quote}`);
    expect(visual.prompt).toContain(`"${master.headline}"`);
    expect(visual.prompt).toContain(`"${master.quote}"`);
  });

  it('prompt forbids invented readable text', () => {
    const visual = buildMirrorVisualFromContext({
      entries: [entry(['cami'])],
      characterName: 'Mimar',
      personaFamilyId: 'balanced_calm',
      seed: 'no-invent-test',
    });
    for (const rule of MASTER_POSTER_TEXT_RULES) {
      expect(visual.prompt).toContain(rule);
    }
    expect(visual.prompt).toContain('Do not add any other readable text');
  });

  it('does not include raw user sentence in prompt', () => {
    const rawSentence =
      'Özbekistanda Semerkant ve Buharada ne yiyebilirim sordun mu';
    const visual = buildMirrorVisualFromContext({
      entries: [
        {
          ...entry(['özbekistan', 'semerkant', 'buhara']),
          vector: { ...entry([]).vector, intent: rawSentence },
        },
      ],
      characterName: 'Yolcu',
      personaFamilyId: 'balanced_calm',
      seed: 'no-raw-test',
    });
    expect(visual.prompt).not.toContain('ne yiyebilirim');
    expect(visual.prompt).not.toContain('sordun');
  });
});

describe('vehicle lock regression with subtopics', () => {
  it('BMW/Mercedes lock preserved with luxury subtopic', () => {
    const entries = [
      entry(['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']),
      entry(['karar']),
    ];
    expect(resolveLockedPrimaryIntent({ entries })).toBe('premium_vehicle_comparison');
    const visual = buildMirrorVisualFromContext({
      entries,
      characterName: 'Sürücü',
      personaFamilyId: 'decision_direction',
      seed: 'vehicle-subtopic-test',
    });
    expect(visual.sceneContractId).toBeTruthy();
    expect(visual.sceneSubtopicId).toBe('vehicle_luxury_sedan_comparison');
    const p = visual.prompt.toLowerCase();
    expect(p).not.toMatch(/\bhighway\b/);
    expect(p).not.toMatch(/\bskyline\b/);
  });
});
