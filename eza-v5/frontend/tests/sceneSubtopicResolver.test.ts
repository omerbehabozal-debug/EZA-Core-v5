import { describe, it, expect } from 'vitest';
import { resolveSceneSubtopics } from '@/lib/eza/mirror/sceneSubtopicResolver';
import { MAX_SCENE_KEYWORDS } from '@/lib/eza/mirror/sceneSubtopicTypes';

describe('resolveSceneSubtopics — travel', () => {
  it('Özbekistan + Semerkant + Buhara → travel_silk_road', () => {
    const r = resolveSceneSubtopics('travel', ['özbekistan', 'semerkant', 'buhara']);
    expect(r.primarySubtopic).toBe('travel_silk_road');
    expect(r.sceneKeywords).toContain('samarkand');
    expect(r.sceneKeywords).toContain('silk_road');
  });

  it('Semerkant + Buhara → travel_silk_road', () => {
    const r = resolveSceneSubtopics('travel', ['semerkant', 'buhara']);
    expect(r.primarySubtopic).toBe('travel_silk_road');
  });

  it('Semerkant alone → travel_samarkand', () => {
    const r = resolveSceneSubtopics('travel', ['semerkant']);
    expect(r.primarySubtopic).toBe('travel_samarkand');
    expect(r.sceneKeywords).toContain('registan');
    expect(r.sceneKeywords).toContain('blue_tiles');
  });

  it('Buhara alone → travel_bukhara', () => {
    const r = resolveSceneSubtopics('travel', ['buhara']);
    expect(r.primarySubtopic).toBe('travel_bukhara');
    expect(r.sceneKeywords).toContain('bukhara');
  });

  it('Özbekistan without city → travel_uzbekistan', () => {
    const r = resolveSceneSubtopics('travel', ['özbekistan']);
    expect(r.primarySubtopic).toBe('travel_uzbekistan');
    expect(r.sceneKeywords).toContain('central_asia');
  });
});

describe('resolveSceneSubtopics — architecture', () => {
  it('cami → arch_mosque_heritage', () => {
    const r = resolveSceneSubtopics('architecture', ['cami']);
    expect(r.primarySubtopic).toBe('arch_mosque_heritage');
    expect(r.sceneKeywords).toContain('mosque_courtyard');
  });

  it('cephe → arch_facade_restoration', () => {
    const r = resolveSceneSubtopics('architecture', ['cephe']);
    expect(r.primarySubtopic).toBe('arch_facade_restoration');
  });

  it('restorasyon → arch_material_study', () => {
    const r = resolveSceneSubtopics('architecture', ['restorasyon']);
    expect(r.primarySubtopic).toBe('arch_material_study');
  });
});

describe('resolveSceneSubtopics — vehicle', () => {
  it('BMW Mercedes → vehicle_luxury_sedan_comparison', () => {
    const r = resolveSceneSubtopics('vehicle', ['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']);
    expect(r.primarySubtopic).toBe('vehicle_luxury_sedan_comparison');
    expect(r.sceneKeywords).toContain('luxury_sedan');
  });

  it('SUV / TOGG → vehicle_suv_comparison', () => {
    expect(resolveSceneSubtopics('vehicle', ['suv']).primarySubtopic).toBe(
      'vehicle_suv_comparison'
    );
    expect(resolveSceneSubtopics('vehicle', ['togg']).primarySubtopic).toBe(
      'vehicle_suv_comparison'
    );
  });

  it('elektrikli / şarj → vehicle_ev_comparison', () => {
    expect(resolveSceneSubtopics('vehicle', ['elektrikli']).primarySubtopic).toBe(
      'vehicle_ev_comparison'
    );
    expect(resolveSceneSubtopics('vehicle', ['şarj']).primarySubtopic).toBe(
      'vehicle_ev_comparison'
    );
  });
});

describe('resolveSceneSubtopics — technology_ai', () => {
  it('cursor + ai → tech_coding_ai', () => {
    const r = resolveSceneSubtopics('technology_ai', ['cursor', 'ai']);
    expect(r.primarySubtopic).toBe('tech_coding_ai');
  });

  it('ürün + roadmap + mvp → tech_product_building', () => {
    const r = resolveSceneSubtopics('technology_ai', ['ürün', 'roadmap', 'mvp']);
    expect(r.primarySubtopic).toBe('tech_product_building');
  });

  it('eza + platform → tech_startup_strategy', () => {
    const r = resolveSceneSubtopics('technology_ai', ['eza', 'platform']);
    expect(r.primarySubtopic).toBe('tech_startup_strategy');
  });

  it('eza + cursor + roadmap + mvp → tech_product_building', () => {
    const r = resolveSceneSubtopics('technology_ai', ['eza', 'cursor', 'roadmap', 'mvp']);
    expect(r.primarySubtopic).toBe('tech_product_building');
  });
});

describe('resolveSceneSubtopics — privacy limits', () => {
  it('empty → topic_generic', () => {
    const r = resolveSceneSubtopics('travel', []);
    expect(r.primarySubtopic).toBe('topic_generic');
    expect(r.sourceCueTokens).toEqual([]);
  });

  it('sceneKeywords max 6 from registry', () => {
    const r = resolveSceneSubtopics('travel', ['semerkant', 'buhara', 'özbekistan']);
    expect(r.sceneKeywords.length).toBeLessThanOrEqual(MAX_SCENE_KEYWORDS);
    for (const kw of r.sceneKeywords) {
      expect(kw.length).toBeLessThanOrEqual(32);
      expect(kw).not.toMatch(/\s{2,}/);
    }
  });
});
