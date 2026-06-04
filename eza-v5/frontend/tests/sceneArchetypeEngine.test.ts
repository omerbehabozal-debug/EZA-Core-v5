import { describe, it, expect } from 'vitest';
import { resolveSceneArchetype } from '@/lib/eza/mirror/sceneArchetypeEngine';

describe('sceneArchetypeEngine (P4-A)', () => {
  it('comparison → crossroads', () => {
    expect(resolveSceneArchetype('comparison').sceneArchetypeId).toBe('crossroads');
  });

  it('vehicle lock → comparison_studio', () => {
    expect(
      resolveSceneArchetype('comparison', 'premium_vehicle_comparison').sceneArchetypeId
    ).toBe('comparison_studio');
  });

  it('creation → workshop', () => {
    expect(resolveSceneArchetype('creation').sceneArchetypeId).toBe('workshop');
  });

  it('exploration → threshold', () => {
    expect(resolveSceneArchetype('exploration').sceneArchetypeId).toBe('threshold');
  });
});
