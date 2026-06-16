import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildHybridPosterPrompt,
  HYBRID_HEADLINE_MAX,
  truncateHybridText,
} from '@/lib/eza/mirror/hybridPosterPromptBuilder';
import {
  HYBRID_POSTER_NEGATIVE,
  hybridNegativeIncludesNoText,
} from '@/lib/eza/mirror/mirrorPosterNegativePrompts';
import { deriveVisualNarrativeDirection } from '@/lib/eza/mirror/visualNarrativeDirector';
import { resolveMirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { buildHybridPosterTextFields } from '@/lib/eza/mirror/posterCardContent';

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);

function foodEntry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'food-hybrid',
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 78,
      intent: 'gluten free dessert recipe',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    mirrorCueHints: ['gluten', 'recipe', 'mutfak'],
    standaloneObservation: {
      user_pattern: { category: 'ideation_creation', confidence: 0.85, signals: ['gluten'] },
      ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
      relationship_balance: { category: 'creative_flow', confidence: 0.8, signals: [] },
    },
  };
}

const FOOD_ENTRIES = [foodEntry(), foodEntry(), foodEntry()];

const HYBRID_COPY = {
  headline: 'Lezzetli & Sağlıklı',
  subheadline: 'Bir Gün',
  description:
    'Glutensiz tatlı arayışın, özenli ve bilinçli seçimlere dönüştü.',
  themeTitle: 'Yaratıcılık & Özen',
  themeDescription: 'Fikirlerini lezzete dönüştürdün; AI sana ilhamla eşlik etti.',
  quote: 'İyi seçimler, küçük tariflerle büyük mutluluklar yaratır.',
};

describe('hybridPosterPromptBuilder (Sprint 13C)', () => {
  it('hybrid prompt includes provided headline', () => {
    const narrative = deriveVisualNarrativeDirection({ entries: FOOD_ENTRIES });
    const { prompt } = buildHybridPosterPrompt({
      narrative,
      ...HYBRID_COPY,
      sceneIntent: 'culinary wellness',
      heroObjects: narrative.heroObjects,
      colorMood: 'warm natural kitchen',
      typographyStyle: 'premium editorial Turkish',
    });
    expect(prompt).toContain('Lezzetli & Sağlıklı');
    expect(prompt.toLowerCase()).toContain('only use the provided turkish text exactly');
  });

  it('hybrid prompt includes required layout markers', () => {
    const narrative = deriveVisualNarrativeDirection({ entries: FOOD_ENTRIES });
    const { prompt } = buildHybridPosterPrompt({
      narrative,
      ...HYBRID_COPY,
      sceneIntent: 'culinary wellness',
      heroObjects: narrative.heroObjects,
      colorMood: 'warm natural kitchen',
      typographyStyle: 'premium editorial Turkish',
    });
    const lower = prompt.toLowerCase();
    expect(lower).toContain('embed the following turkish text into the artwork');
    expect(lower).toContain('leave top 10% empty');
    expect(lower).toContain('leave bottom 25% empty');
    expect(lower).toContain('use elegant editorial typography');
    expect(lower).toContain('do not generate ui cards');
  });

  it('hybrid prompt does not instruct EZA logo placement', () => {
    const narrative = deriveVisualNarrativeDirection({ entries: FOOD_ENTRIES });
    const { prompt } = buildHybridPosterPrompt({
      narrative,
      ...HYBRID_COPY,
      sceneIntent: 'culinary',
      heroObjects: narrative.heroObjects,
      colorMood: 'warm',
      typographyStyle: 'editorial',
    });
    expect(prompt).toContain('Do not add EZA logo');
    expect(prompt.toLowerCase()).toContain('do not add eza logo');
  });

  it('hybrid negative does not include blanket no text', () => {
    expect(hybridNegativeIncludesNoText()).toBe(false);
    expect(HYBRID_POSTER_NEGATIVE.join(' ').toLowerCase()).not.toContain('no text');
  });

  it('hybrid negative includes no logo / footer / SEN AI DENGE', () => {
    const neg = HYBRID_POSTER_NEGATIVE.join(' ').toLowerCase();
    expect(neg).toContain('no logo');
    expect(neg).toContain('no footer');
    expect(neg).toContain('sen ai denge');
  });

  it('long headline is truncated', () => {
    const long = 'Bu çok uzun bir başlık metni kesilmeli';
    expect(long.length).toBeGreaterThan(HYBRID_HEADLINE_MAX);
    const truncated = truncateHybridText(long, HYBRID_HEADLINE_MAX);
    expect(truncated.length).toBeLessThanOrEqual(HYBRID_HEADLINE_MAX);
  });

  it('DailyMirrorPosterCard hybrid mode hides frontend headline/theme/quote zones', () => {
    expect(posterSrc).toContain('isHybridMiddle');
    expect(posterSrc).toContain('hideFrontendMiddle');
    expect(posterSrc).toContain('!hideFrontendMiddle');
    expect(posterSrc).toContain('embeddedScenePreview');
    expect(posterSrc).toContain('data-mirror-render-mode');
  });

  it('scene_only mode still references frontend text overlays in source', () => {
    expect(posterSrc).toContain('PosterIdentityHeadline');
    expect(posterSrc).toContain('content.rhythm.word');
    expect(posterSrc).toContain('PosterTomorrowHint');
  });

  it('feature flag false resolves to scene_only by default', () => {
    expect(resolveMirrorRenderMode('scene_only')).toBe('scene_only');
  });

  it('feature flag true resolves to hybrid_middle', () => {
    const prev = process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER;
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = 'true';
    expect(resolveMirrorRenderMode()).toBe('hybrid_middle');
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER;
    } else {
      process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = prev;
    }
  });
});

describe('hybrid visual prompt integration', () => {
  const prevHybrid = process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER;

  afterEach(() => {
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = prevHybrid;
  });

  it('buildMirrorVisualFromContext uses hybrid prompt when mode and copy provided', () => {
    const narrative = deriveVisualNarrativeDirection({ entries: FOOD_ENTRIES });
    const hybridCopy = buildHybridPosterTextFields({
      dailyJourney: HYBRID_COPY.headline,
      mirrorStory: HYBRID_COPY.description,
      quote: HYBRID_COPY.quote,
      themeDescription: HYBRID_COPY.themeDescription,
      personaFamilyId: 'ideation_creation',
      topicLabel: 'yaratıcılık ve ilham',
    });
    const visual = buildMirrorVisualFromContext({
      entries: FOOD_ENTRIES,
      characterName: 'Yaratıcı',
      personaFamilyId: 'ideation_creation',
      seed: 'hybrid-food',
      renderMode: 'hybrid_middle',
      hybridCopy,
    });
    expect(visual.renderMode).toBe('hybrid_middle');
    expect(visual.prompt).toContain('middle artwork zone');
    expect(visual.prompt).toContain(hybridCopy.headline);
    expect(visual.negativePrompt.toLowerCase()).not.toContain('no text,');
    expect(visual.negativePrompt.toLowerCase()).toContain('no logo');
  });
});
