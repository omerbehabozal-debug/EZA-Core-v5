import { describe, it, expect } from 'vitest';
import {
  canonicalizeCoverageToken,
  canonicalizeCoverageTokens,
  foldTurkishDiacritics,
  matchCoveragePattern,
  normalizeCoverageText,
} from '@/lib/eza/mirror/coverage/coverageSynonyms';
import {
  extractCoverageCueTokens,
  getCoverageTopicForToken,
  resolveCoverageSubtopic,
} from '@/lib/eza/mirror/coverage/coverageLibrary';
import { applyCoverageConflictRules } from '@/lib/eza/mirror/coverage/coverageConflictRules';
import {
  extractStoryCueTokens,
  resolveStoryTopics,
} from '@/lib/eza/mirror/storyTopicResolver';
import { resolveSceneSubtopics } from '@/lib/eza/mirror/sceneSubtopicResolver';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

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

describe('coverageSynonyms — normalization', () => {
  it('folds Turkish diacritics for match comparison', () => {
    expect(foldTurkishDiacritics('özbekistan')).toBe('ozbekistan');
    expect(foldTurkishDiacritics('şehir')).toBe('sehir');
  });

  it('canonicalizes semerkand / semerkant / samarkand to semerkant', () => {
    expect(canonicalizeCoverageToken('semerkand')).toBe('semerkant');
    expect(canonicalizeCoverageToken('samarkand')).toBe('semerkant');
    expect(canonicalizeCoverageToken('semerkant')).toBe('semerkant');
  });

  it('canonicalizes buhara / bukhara', () => {
    expect(canonicalizeCoverageToken('bukhara')).toBe('buhara');
    expect(canonicalizeCoverageToken('buhara')).toBe('buhara');
  });

  it('canonicalizes özbekistan / ozbekistan / uzbekistan', () => {
    expect(canonicalizeCoverageToken('ozbekistan')).toBe('özbekistan');
    expect(canonicalizeCoverageToken('uzbekistan')).toBe('özbekistan');
    expect(canonicalizeCoverageToken('özbekistan')).toBe('özbekistan');
  });

  it('matches patterns with diacritic folding', () => {
    const text = normalizeCoverageText('Ozbekistan gezisi Semerkand');
    expect(matchCoveragePattern(text, 'özbekistan')).toBe(true);
    expect(matchCoveragePattern(text, 'semerkant')).toBe(true);
  });
});

describe('coverageLibrary — travel gap fixes', () => {
  it('ispanya alone → travel_spain', () => {
    const r = resolveCoverageSubtopic('travel', ['ispanya']);
    expect(r?.subtopic).toBe('travel_spain');
  });

  it('ispanya + sevilla → travel_andalusia', () => {
    const r = resolveSceneSubtopics('travel', ['ispanya', 'sevilla']);
    expect(r.primarySubtopic).toBe('travel_andalusia');
  });

  it('sevilla / seville / endülüs / andalusia extract and match', () => {
    expect(extractStoryCueTokens('Seville ve Endülüs rotası')).toContain('sevilla');
    expect(extractStoryCueTokens('Andalusia trip to Cordoba')).toContain('cordoba');
    const r = resolveSceneSubtopics('travel', ['sevilla', 'endülüs']);
    expect(r.primarySubtopic).toBe('travel_andalusia');
  });

  it('mardin + seyahat → travel_mardin', () => {
    const r = resolveSceneSubtopics('travel', ['mardin', 'seyahat', 'rota']);
    expect(r.primarySubtopic).toBe('travel_mardin');
  });

  it('extracts ispanya from Spain text', () => {
    const tokens = extractStoryCueTokens('Spain travel itinerary');
    expect(tokens).toContain('ispanya');
    expect(getCoverageTopicForToken('ispanya')).toBe('travel');
  });
});

describe('coverageLibrary — architecture gap fixes', () => {
  it('mardin + mimari → arch_mardin_heritage', () => {
    const r = resolveSceneSubtopics('architecture', ['mardin', 'mimari']);
    expect(['arch_mardin_heritage', 'arch_mardin_stone']).toContain(r.primarySubtopic);
  });

  it('mardin + taş şehir / avlu → arch_mardin_heritage', () => {
    const tokens = extractStoryCueTokens('Mardin taş şehir avlulu evler');
    expect(tokens).toContain('mardin');
    const r = resolveSceneSubtopics('architecture', tokens);
    expect(r.primarySubtopic).toBe('arch_mardin_heritage');
  });

  it('tonoz alone → arch_vault_study', () => {
    const r = resolveSceneSubtopics('architecture', ['tonoz']);
    expect(r.primarySubtopic).toBe('arch_vault_study');
  });

  it('tonoz + restorasyon → arch_vault_study', () => {
    const r = resolveSceneSubtopics('architecture', ['tonoz', 'restorasyon']);
    expect(r.primarySubtopic).toBe('arch_vault_study');
  });

  it('tonoz + cami + kubbe → arch_mosque_heritage', () => {
    const r = resolveSceneSubtopics('architecture', ['tonoz', 'cami', 'kubbe']);
    expect(r.primarySubtopic).toBe('arch_mosque_heritage');
  });
});

describe('coverageLibrary — regression via integrated resolver', () => {
  it('Özbekistan + Semerkant + Buhara → travel_silk_road', () => {
    const r = resolveSceneSubtopics('travel', ['özbekistan', 'semerkant', 'buhara']);
    expect(r.primarySubtopic).toBe('travel_silk_road');
  });

  it('Semerkant alone → travel_samarkand', () => {
    expect(resolveSceneSubtopics('travel', ['semerkant']).primarySubtopic).toBe(
      'travel_samarkand'
    );
  });

  it('Buhara alone → travel_bukhara', () => {
    expect(resolveSceneSubtopics('travel', ['buhara']).primarySubtopic).toBe('travel_bukhara');
  });

  it('BMW/Mercedes vehicle comparison unchanged', () => {
    const r = resolveSceneSubtopics('vehicle', ['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']);
    expect(r.primarySubtopic).toBe('vehicle_luxury_sedan_comparison');
  });

  it('EZA / Cursor / MVP technology subtopics unchanged', () => {
    expect(
      resolveSceneSubtopics('technology_ai', ['cursor', 'ai']).primarySubtopic
    ).toBe('tech_coding_ai');
    expect(
      resolveSceneSubtopics('technology_ai', ['ürün', 'roadmap', 'mvp']).primarySubtopic
    ).toBe('tech_product_building');
    expect(
      resolveSceneSubtopics('technology_ai', ['eza', 'cursor', 'roadmap', 'mvp']).primarySubtopic
    ).toBe('tech_product_building');
  });

  it('restorasyon alone still → arch_material_study (legacy path)', () => {
    expect(resolveSceneSubtopics('architecture', ['restorasyon']).primarySubtopic).toBe(
      'arch_material_study'
    );
  });
});

describe('coverageLibrary — topic resolution for Mardin', () => {
  it('mardin + seyahat resolves travel topic', () => {
    const resolution = resolveStoryTopics([entry(['mardin', 'seyahat', 'gezi'])]);
    expect(resolution.primaryTopic).toBe('travel');
  });

  it('mardin + mimari resolves architecture topic', () => {
    const resolution = resolveStoryTopics([entry(['mardin', 'mimari', 'taş şehir'])]);
    expect(resolution.primaryTopic).toBe('architecture');
  });
});

describe('coverageConflictRules', () => {
  it('applies tonoz vault rule without cami', () => {
    const resolved = applyCoverageConflictRules('architecture', ['tonoz'], [
      { subtopic: 'arch_material_study', confidence: 0.72, priority: 65 },
      { subtopic: 'arch_vault_study', confidence: 0.72, priority: 82 },
    ]);
    expect(resolved?.subtopic).toBe('arch_vault_study');
    expect(resolved?.ruleId).toBe('tonoz_vault_study');
  });
});

describe('extractCoverageCueTokens', () => {
  it('returns canonical coverage tokens only', () => {
    const tokens = extractCoverageCueTokens('Mardin taş şehir mimari restorasyon tonoz', 12);
    const canon = canonicalizeCoverageTokens(tokens);
    expect(canon).toContain('mardin');
    expect(canon).toContain('tonoz');
    expect(canon).toContain('taş');
  });
});
