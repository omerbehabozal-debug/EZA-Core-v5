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
    expect(personaIllustrationSrc('balanced_calm')).toContain('/personas/balanced_calm.webp');
  });

  it('pickStandalonePersona merges asset slots', () => {
    const persona = pickStandalonePersona('balanced_calm', 'test');
    expect(persona.illustrationKey).toBe('balanced_calm');
    expect(persona.iconFallback).toBeTruthy();
    expect(persona.visualTone).toBe('soft_animal');
    expect(persona.colorToken).toBe('stone');
  });

  it('all ten companion webp assets exist on disk', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const dir = path.join(process.cwd(), 'public', 'personas');
    const names = [
      'curiosity_exploration',
      'decision_direction',
      'clarity_simplification',
      'ideation_creation',
      'deep_thinking',
      'sensitive_careful',
      'fast_practical',
      'planning_structure',
      'trust_verification',
      'balanced_calm',
    ];
    for (const name of names) {
      expect(fs.existsSync(path.join(dir, `${name}.webp`))).toBe(true);
    }
  });
});
