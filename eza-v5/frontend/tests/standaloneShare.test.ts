import { describe, it, expect } from 'vitest';
import { buildDailyObservationFromEntries } from '@/lib/eza/dailyObservation';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import {
  buildObservationSharePayload,
  buildRelationshipMapSharePayload,
} from '@/lib/eza/standaloneShare';
import { buildRelationshipMap } from '@/lib/eza/relationshipMapModel';
import { personaIllustrationSrc } from '@/lib/eza/personaAssets';

describe('standaloneShare', () => {
  it('observation share payload uses calm copy and mirror lines', () => {
    const observation = buildDailyObservationFromEntries([], 'seed');
    const persona = pickStandalonePersona(observation.categoryId, 'seed');
    const payload = buildObservationSharePayload(observation, persona);

    expect(payload.title).toBe('AI ile son etkileşim gözlemim');
    expect(payload.clipboardText).toContain('eza.global');
    expect(payload.clipboardText).toContain(persona.name);
    expect(payload.clipboardText).not.toMatch(/şok|inanılmaz|kaçırma/i);
    expect(payload.insight.length).toBeGreaterThan(0);
  });

  it('relationship map share handles empty islands', () => {
    const model = buildRelationshipMap([], 30);
    const payload = buildRelationshipMapSharePayload(model);

    expect(payload.title).toBe('EZA ilişki haritamdan kısa bir not');
    expect(payload.topIslands).toHaveLength(0);
    expect(payload.clipboardText).toContain('Henüz belirgin bir ada oluşmadı');
    expect(payload.clipboardText).toContain('eza.global');
  });

  it('persona illustration src is null without key', () => {
    expect(personaIllustrationSrc(undefined)).toBeNull();
    expect(personaIllustrationSrc('balanced-calm')).toContain('/personas/balanced-calm.webp');
  });

  it('pickStandalonePersona merges asset slots', () => {
    const persona = pickStandalonePersona('balanced_calm', 'test');
    expect(persona.illustrationKey).toBe('balanced-calm');
    expect(persona.iconFallback).toBeTruthy();
    expect(persona.visualTone).toBe('soft_animal');
    expect(persona.colorToken).toBe('stone');
  });
});
