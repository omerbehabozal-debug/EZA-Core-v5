import { describe, expect, it } from 'vitest';
import { hasPinnedMappedMirrorPrompt } from '@/lib/eza/mirror/pinnedMappedMirrorPrompt';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function cardWithPrompt(
  prompt: string,
  promptSource?: string
): DailyMirrorCardModel {
  return {
    date: '2026-07-23',
    dayLabel: '23',
    headline: 't',
    characterName: 'c',
    personaFamilyId: 'sensitive_careful',
    shortInsight: 'i',
    userLine: 'u',
    aiLine: 'a',
    balanceLine: 'b',
    signalLevel: 'low',
    confidence: 'medium',
    energyLabel: 'e',
    energyScore: 1,
    shareEnabled: true,
    privacyText: 'p',
    visual: {
      characterId: '',
      characterName: 'c',
      personaFamilyId: 'sensitive_careful',
      topicLabel: 'travel',
      atmosphereLabel: '',
      emotionLabel: '',
      prompt,
      negativePrompt: '',
      stylePreset: '',
      seedHint: 's',
    },
    ...(promptSource
      ? {
          mirrorDirectorMetadata: {
            promptSource,
          } as DailyMirrorCardModel['mirrorDirectorMetadata'],
        }
      : {}),
  };
}

describe('hasPinnedMappedMirrorPrompt', () => {
  it('accepts interpretation-mapped prompts', () => {
    expect(
      hasPinnedMappedMirrorPrompt(
        cardWithPrompt(
          'VISUAL NARRATIVE:\nMardin stone street with a wooden chair.',
          'interpretation_v5_mapper'
        )
      )
    ).toBe(true);
  });

  it('accepts VISUAL NARRATIVE prefix without metadata', () => {
    expect(
      hasPinnedMappedMirrorPrompt(
        cardWithPrompt('VISUAL NARRATIVE:\nA clothesline and mosque silhouette.')
      )
    ).toBe(true);
  });

  it('rejects empty or heuristic prompts', () => {
    expect(hasPinnedMappedMirrorPrompt(null)).toBe(false);
    expect(hasPinnedMappedMirrorPrompt(cardWithPrompt('golden_hour_travel'))).toBe(
      false
    );
  });
});

describe('Yeni Sahne reuses pinned mapped prompt (source)', () => {
  const experienceSrc = readFileSync(
    join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
    'utf8'
  );

  it('passes reuseMappedPrompt on new scene and gates prepare', () => {
    expect(experienceSrc).toContain('hasPinnedMappedMirrorPrompt');
    expect(experienceSrc).toContain('reuseMappedPrompt: true');
    expect(experienceSrc).toContain('!reuseMappedPrompt');
    expect(experienceSrc).toMatch(
      /handleNewMirrorScene[\s\S]*handleGenerateMirrorScene\(nextSession,\s*\{\s*reuseMappedPrompt:\s*true\s*\}\)/
    );
  });
});
