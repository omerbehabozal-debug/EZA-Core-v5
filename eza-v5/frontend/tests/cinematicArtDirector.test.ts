import { describe, it, expect } from 'vitest';
import {
  buildArtDirectionPromptBlock,
  mergeArtDirectionNegatives,
  resolveArtDirection,
  ART_DIRECTION_BLOCK_MAX,
} from '@/lib/eza/mirror/cinematicArtDirector';
import { getArtDirectionProfile } from '@/lib/eza/mirror/artDirectionRegistry';
import { resolveSceneSubtopics } from '@/lib/eza/mirror/sceneSubtopicResolver';

describe('resolveArtDirection — subtopic profiles', () => {
  it('travel_silk_road → golden hour / travel editorial / magazine cover', () => {
    const subtopic = resolveSceneSubtopics('travel', ['özbekistan', 'semerkant', 'buhara']);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'travel',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('golden hour');
    expect(block).toContain('travel editorial');
    expect(block).toContain('magazine');
    expect(profile.negativeExtras.join(' ')).toMatch(/stock postcard/);
  });

  it('arch_mosque_heritage → museum-grade / courtyard / symmetry', () => {
    const subtopic = resolveSceneSubtopics('architecture', ['cami']);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'architecture',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('museum-grade');
    expect(block).toContain('courtyard');
    expect(block).toContain('symmetry');
  });

  it('vehicle_suv_comparison → premium automotive studio / no outdoor road negatives', () => {
    const subtopic = resolveSceneSubtopics('vehicle', ['suv', 'togg']);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'general',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('automotive studio');
    expect(profile.negativeExtras.join(' ')).toMatch(/outdoor road/);
    expect(profile.forbiddenEnvironments).toContain('highway');
  });

  it('vehicle lock forces luxury sedan art direction when cues are BMW/Mercedes', () => {
    const subtopic = resolveSceneSubtopics('vehicle', ['bmw', 'mercedes', 'konfor', 'vs']);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'general',
      lockedIntent: 'premium_vehicle_comparison',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('showroom');
    expect(block).toContain('executive');
  });

  it('tech_product_building → startup product lab / no cyberpunk', () => {
    const subtopic = resolveSceneSubtopics('technology_ai', ['eza', 'cursor', 'roadmap', 'mvp']);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'creativity',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('product lab');
    expect(profile.negativeExtras.join(' ')).toMatch(/cyberpunk/);
    expect(profile.negativeExtras.join(' ')).toMatch(/robot/);
  });

  it('topic_generic → calm editorial scene', () => {
    const subtopic = resolveSceneSubtopics('travel', []);
    const profile = resolveArtDirection({
      sceneSubtopicResolution: subtopic,
      topicKey: 'general',
    });
    const block = buildArtDirectionPromptBlock(profile).toLowerCase();
    expect(block).toContain('calm editorial');
  });
});

describe('buildArtDirectionPromptBlock', () => {
  it('stays within max character budget', () => {
    const profiles = [
      getArtDirectionProfile('travel_silk_road'),
      getArtDirectionProfile('arch_mosque_heritage'),
      getArtDirectionProfile('vehicle_suv_comparison'),
      getArtDirectionProfile('tech_product_building'),
      getArtDirectionProfile('topic_generic'),
    ];
    for (const profile of profiles) {
      expect(buildArtDirectionPromptBlock(profile).length).toBeLessThanOrEqual(
        ART_DIRECTION_BLOCK_MAX
      );
    }
  });
});

describe('mergeArtDirectionNegatives', () => {
  it('deduplicates extras already in base negative', () => {
    const base = 'no UI, stock postcard, no text';
    const merged = mergeArtDirectionNegatives(base, getArtDirectionProfile('travel_silk_road'));
    const parts = merged.split(',').map((p) => p.trim().toLowerCase());
    const stockCount = parts.filter((p) => p === 'stock postcard').length;
    expect(stockCount).toBe(1);
    expect(merged.toLowerCase()).toContain('tourist crowd');
  });
});
