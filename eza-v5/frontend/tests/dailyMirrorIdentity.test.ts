import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';
import {
  buildDailyAvatarSeed,
  getBehaviorFamilyLabel,
  pickDailyAvatar,
} from '@/lib/eza/mirror/dailyAvatarRegistry';
import { resolveDailyTheme } from '@/lib/eza/mirror/dailyThemeRegistry';
import { composeDailyMirrorIdentity } from '@/lib/eza/mirror/dailyMirrorIdentity';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const EXPLORATION_OBS = {
  user_pattern: {
    category: 'curiosity_exploration',
    confidence: 0.85,
    signals: ['keşif', 'merak'],
  },
  ai_behavior: { category: 'explanatory', confidence: 0.8, signals: ['explore'] },
  relationship_balance: { category: 'curious_balance', confidence: 0.75, signals: [] },
};

function makeEntry(overrides: Partial<SavedBehavioralEntry> = {}): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'fixed-id-1',
    mode: 'standalone',
    savedAt: '2026-01-15T10:00:00.000Z',
    vector: {
      input_risk: 0.15,
      output_risk: 0.1,
      input_health: 0.85,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 80,
      intent: 'question',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.05, risk_delta_output_minus_input: -0.05, index: 0.1 },
    standaloneObservation: EXPLORATION_OBS,
    ...overrides,
  };
}

function buildStableEntries(count = MIRROR_MIN_SAMPLES): SavedBehavioralEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      interaction_id: `stable-${i}`,
      savedAt: `2026-01-15T${10 + i}:00:00.000Z`,
    })
  );
}

const IDENTITY_FIELD_KEYS: (keyof DailyMirrorCardModel)[] = [
  'behaviorFamilyLabel',
  'dailyAvatarId',
  'dailyAvatarName',
  'dailyAvatarEmoji',
  'dailyAvatarType',
  'dailyAvatarArchetypeId',
  'dailyThemeTitle',
  'dailyThemeSubtitle',
  'dailySceneConcept',
];

describe('Daily Mirror identity layer (P0)', () => {
  it('same entries produce the same dailyAvatar', () => {
    const entries = buildStableEntries();
    const a = buildMirrorState(entries, { seed: 'identity-stable' });
    const b = buildMirrorState(entries, { seed: 'identity-stable' });
    expect(a.dailyMirrorCard.dailyAvatarId).toBe(b.dailyMirrorCard.dailyAvatarId);
    expect(a.dailyMirrorCard.dailyAvatarName).toBe(b.dailyMirrorCard.dailyAvatarName);
  });

  it('same entries do not change avatar across rebuilds (seed not tied to wall-clock today)', () => {
    const entries = buildStableEntries();
    const pickInput = {
      mirrorSeed: 'identity-stable',
      cardDate: '2026-01-15',
      latestEntryAt: '2026-01-15T12:00:00.000Z',
      entryCount: entries.length,
      personaFamilyId: 'curiosity_exploration' as const,
      storyTopicKey: 'general' as const,
      storyVariant: 'default' as const,
      microMood: 'neutral' as const,
      intentFingerprint: 'fp-a',
    };
    const avatarA = pickDailyAvatar('curiosity_exploration', pickInput);
    const avatarB = pickDailyAvatar('curiosity_exploration', pickInput);
    expect(avatarA.id).toBe(avatarB.id);
    const seed = buildDailyAvatarSeed(pickInput);
    expect(seed).not.toMatch(new RegExp(`^${new Date().toISOString().slice(0, 10)}`));
    expect(seed).toContain('2026-01-15');
  });

  it('new entry or different latestEntryAt can change dailyAvatar', () => {
    const basePick = {
      mirrorSeed: 'identity-change',
      cardDate: '2026-01-15',
      latestEntryAt: '2026-01-15T11:00:00.000Z',
      entryCount: 3,
      personaFamilyId: 'curiosity_exploration' as const,
      storyTopicKey: 'general' as const,
    };
    const changedPick = {
      ...basePick,
      latestEntryAt: '2026-02-01T18:30:00.000Z',
      entryCount: 4,
    };
    const before = pickDailyAvatar('curiosity_exploration', basePick);
    const after = pickDailyAvatar('curiosity_exploration', changedPick);
    expect(before.id).not.toBe(after.id);
  });

  it('behaviorFamilyLabel maps PersonaFamilyId to user-facing label', () => {
    expect(getBehaviorFamilyLabel('curiosity_exploration')).toBe('Keşif Ailesi');
    expect(getBehaviorFamilyLabel('decision_direction')).toBe('Karar Ailesi');
    const entries = buildStableEntries();
    const state = buildMirrorState(entries, { seed: 'family-label' });
    expect(state.dailyMirrorCard.behaviorFamilyLabel).toBe('Keşif Ailesi');
  });

  it('dailyThemeTitle uses safe fallback without fabricated cues', () => {
    const theme = resolveDailyTheme([], 'general');
    expect(theme.dailyThemeTitle).toBe('Günün Düşüncesi');
    expect(theme.dailyThemeSubtitle.length).toBeGreaterThan(0);
    const archEntries = [
      makeEntry({
        standaloneObservation: {
          ...EXPLORATION_OBS,
          user_pattern: {
            category: 'planning_structure',
            confidence: 0.8,
            signals: ['mimari', 'villa', 'restorasyon'],
          },
        },
      }),
    ];
    const archTheme = resolveDailyTheme(archEntries, 'architecture');
    expect(archTheme.dailyThemeTitle).toBe('Mimari Tasarım');
  });

  it('characterName equals dailyAvatarName on built card', () => {
    const state = buildMirrorState(buildStableEntries(), { seed: 'name-sync' });
    expect(state.dailyMirrorCard.characterName).toBe(state.dailyMirrorCard.dailyAvatarName);
  });

  it('DailyMirrorCardModel includes new identity fields from buildMirrorState', () => {
    const card = buildMirrorState(buildStableEntries(), { seed: 'fields' }).dailyMirrorCard;
    for (const key of IDENTITY_FIELD_KEYS) {
      expect(card[key], `missing ${key}`).toBeTruthy();
    }
    expect(card.dailySceneConcept).toMatch(/\.$/);
  });

  it('buildMirrorState remains backward compatible (core fields unchanged)', () => {
    const result = buildMirrorState(buildStableEntries(), {
      seed: 'compat',
      generatedAt: '2026-05-21T12:00:00.000Z',
    });
    expect(result.meta.hasEnoughData).toBe(true);
    expect(result.dailyMirrorCard.userLine.length).toBeGreaterThan(0);
    expect(result.dailyMirrorCard.visual?.characterName).toBe(
      result.dailyMirrorCard.dailyAvatarName
    );
    expect(result.relationshipPattern.isShareable).toBe(false);
  });

  it('composeDailyMirrorIdentity produces theme + narrative scene concept', () => {
    const entries = [
      makeEntry({
        standaloneObservation: {
          ...EXPLORATION_OBS,
          user_pattern: {
            category: 'curiosity_exploration',
            confidence: 0.9,
            signals: ['semerkant', 'registan', 'seyahat'],
          },
        },
      }),
    ];
    const layer = composeDailyMirrorIdentity({
      entries,
      mirrorSeed: 'samarkand',
      cardDate: '2026-01-15',
      personaFamilyId: 'curiosity_exploration',
      storyTopicKey: 'travel',
    });
    expect(layer.dailyThemeTitle).toBe('Semerkant Yolculuğu');
    expect(layer.dailySceneConcept).toContain(layer.dailyAvatarName);
    expect(layer.dailySceneConcept.toLowerCase()).toMatch(/looking beyond|familiar/);
  });
});
