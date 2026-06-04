import { describe, it, expect } from 'vitest';
import {
  buildFullCanvasNarrativePromptBlock,
  narrativePromptSectionOrder,
  NARRATIVE_NEGATIVE_PROMPT_EXTRAS,
} from '@/lib/eza/mirror/dailyMirrorFullCanvasPrompt';

const SAMPLE = {
  mirrorMoment: 'Standing still before choosing.',
  storyTensionTitle: 'Two paths. One decision.',
  storyTensionSummary: 'Two strong options weighed with calm focus.',
  sceneArchetypeId: 'crossroads' as const,
  dailyThemeTitle: 'Araç Kararı',
  dailyAvatarId: 'still_lake',
  dailyAvatarName: 'Durgun Göl',
  identityMoodLens: 'still reflective calm, clarity before movement',
  narrativeCoreId: 'comparison',
};

describe('dailyMirrorFullCanvasPrompt (P4-A)', () => {
  it('includes mirror moment as primary visual cue', () => {
    const block = buildFullCanvasNarrativePromptBlock(SAMPLE);
    expect(block.toLowerCase()).toContain('visual moment: standing still before choosing');
  });

  it('includes no UI / no card / no poster rules', () => {
    const block = buildFullCanvasNarrativePromptBlock(SAMPLE);
    expect(block.toLowerCase()).toMatch(/no text/);
    expect(block.toLowerCase()).toMatch(/not a card/);
    expect(block.toLowerCase()).toMatch(/not a card, infographic, ui mockup, poster/);
  });

  it('does not use percentage safe zones', () => {
    const block = buildFullCanvasNarrativePromptBlock(SAMPLE);
    expect(block).not.toMatch(/\d+\s*%/);
    expect(block.toLowerCase()).toContain('away from the top and bottom edges');
  });

  it('does not use literal mascot as main subject', () => {
    const block = buildFullCanvasNarrativePromptBlock(SAMPLE);
    expect(block.toLowerCase()).not.toContain('calm panda');
    expect(block.toLowerCase()).not.toContain('curious fox');
    expect(block.toLowerCase()).not.toContain('deer doctor');
    expect(block.toLowerCase()).toContain('do not depict a panda');
  });

  it('orders moment before tension before archetype before theme before lens', () => {
    const block = buildFullCanvasNarrativePromptBlock(SAMPLE);
    const order = narrativePromptSectionOrder(block);
    expect(order.momentIdx).toBeGreaterThanOrEqual(0);
    expect(order.tensionIdx).toBeGreaterThan(order.momentIdx);
    expect(order.archetypeIdx).toBeGreaterThan(order.tensionIdx);
    expect(order.themeIdx).toBeGreaterThan(order.archetypeIdx);
    expect(order.lensIdx).toBeGreaterThan(order.themeIdx);
  });

  it('negative prompt extras include poster and mascot', () => {
    expect(NARRATIVE_NEGATIVE_PROMPT_EXTRAS).toContain('poster');
    expect(NARRATIVE_NEGATIVE_PROMPT_EXTRAS).toContain('mascot');
    expect(NARRATIVE_NEGATIVE_PROMPT_EXTRAS).toContain('interface');
  });
});
