import { describe, it, expect } from 'vitest';
import {
  buildMirrorNegativePrompt,
  buildVisualCanonLayers,
  EZA_GLOBAL_STYLE_LOCK,
  EZA_NEGATIVE_AVOID,
  EZA_PROMPT_QUALITY_RULES,
  EZA_VISUAL_STYLE_CONTRACT,
  STANDARD_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/ezaVisualCanon';
import {
  buildCharacterBiblePhrase,
  resolveCharacterArchetype,
  TOPIC_TO_ARCHETYPE,
} from '@/lib/eza/mirror/ezaCharacterBible';
import { buildVisualPrompt } from '@/lib/eza/mirror/visualPromptEngine';

function promptLower(prompt: string): string {
  return prompt.toLowerCase();
}

describe('ezaVisualCanon', () => {
  it('style contract includes mature editorial DNA', () => {
    const c = promptLower(EZA_VISUAL_STYLE_CONTRACT);
    expect(c).toContain('premium soft 3d realism');
    expect(c).toContain('editorial character illustration');
    expect(c).toContain('no plastic mascot look');
  });

  it('canon layers include stylized lock and mature premium rules (10G)', () => {
    const layers = buildVisualCanonLayers().join(', ').toLowerCase();
    expect(layers).toContain('not a toy');
    expect(layers).toContain('premium stylized cinematic character');
    expect(layers).toContain('not photorealistic');
    expect(layers).toContain('not a real human portrait');
    expect(layers).toContain('refined proportions');
    expect(EZA_GLOBAL_STYLE_LOCK.toLowerCase()).toContain(
      'premium collectible character not a children\'s toy'
    );
  });

  it('Sprint 11J — negative prompt includes context-aware scene avoid', () => {
    const neg = buildMirrorNegativePrompt('finance').toLowerCase();
    expect(neg).toContain('generic mascot scene');
    expect(neg).toContain('chat screenshot');
    expect(neg).toContain('random panda');
  });

  it('Sprint 11G — canon layers and negative include editorial film + mascot avoid', () => {
    const layers = buildVisualCanonLayers().join(', ').toLowerCase();
    expect(layers).toContain('premium editorial animated film aesthetic');
    expect(layers).toContain('cinematic film still atmosphere');
    const neg = buildMirrorNegativePrompt('general').toLowerCase();
    expect(neg).toContain('mascot app character');
    expect(neg).toContain('plush texture');
    expect(neg).toContain('kawaii expression');
    expect(neg).toContain('sticker mascot energy');
  });

  it('standard negative blocks photoreal portrait and bean mascot (10G)', () => {
    const neg = STANDARD_NEGATIVE_PROMPT.toLowerCase();
    expect(neg).toContain('photorealistic portrait');
    expect(neg).toContain('real human photo');
    expect(neg).toContain('bean mascot');
    expect(neg).toContain('pixar child face');
  });

  it('Sprint 10D — travel negative includes bean/felt/toddler', () => {
    const neg = buildMirrorNegativePrompt('travel').toLowerCase();
    expect(neg).toContain('bean head');
    expect(neg).toContain('felt toy');
    expect(neg).toContain('toddler proportions');
  });

  it('Sprint 10F — architecture negative blocks toys not integrated humans', () => {
    const neg = buildMirrorNegativePrompt('architecture').toLowerCase();
    expect(neg).toMatch(/bean animal|bean character/);
    expect(neg).toContain('toy architect');
    expect(neg).toContain('childish architect');
    expect(neg).not.toContain('no foreground character');
    expect(neg).not.toContain('no human character');
  });

  it('negative prompt blocks childish toy sticker bean', () => {
    const neg = promptLower(STANDARD_NEGATIVE_PROMPT);
    expect(neg).toContain('childish');
    expect(neg).toContain('toy');
    expect(neg).toContain('sticker');
    expect(neg).toContain('bean character');
    expect(neg).toContain('plastic toy');
    expect(neg).toContain('cheap mascot');
    expect(neg).toContain('baby face');
    expect(EZA_NEGATIVE_AVOID).toContain('overly cute');
  });
});

describe('ezaCharacterBible prompts', () => {
  it('finance uses intent-first decision scene (not owl terrace default)', () => {
    expect(TOPIC_TO_ARCHETYPE.finance).toBe('wise_owl');
    const p = promptLower(
      buildVisualPrompt({
        characterId: 'decision_direction',
        characterName: 'Stratej Yolcu',
        personaFamilyId: 'decision_direction',
        topicKey: 'finance',
        seedHint: 'fin',
      }).prompt
    );
    expect(p).toMatch(/research|decision|quiet research desk|financial/);
    expect(p).not.toContain('bilgeli baykuş');
    expect(p).toContain('not a toy');
    expect(p).toContain('mature premium editorial character');
  });

  it('health uses compassionate deer wellness language', () => {
    const visual = buildVisualPrompt({
        characterId: 'balanced_calm',
        characterName: 'Şefkatli Geyik',
        personaFamilyId: 'balanced_calm',
        topicKey: 'health',
        seedHint: 'health',
      });
    const p = promptLower(visual.prompt);
    expect(p).toMatch(/wellness|lavender|lake|şefkatli geyik|deer/);
    expect(visual.negativePrompt.toLowerCase()).toContain('bean character');
  });

  it('friendship uses bridge empathy language', () => {
    const p = promptLower(
      buildVisualPrompt({
        characterId: 'sensitive_careful',
        characterName: 'Köprü Kurucu',
        personaFamilyId: 'sensitive_careful',
        topicKey: 'friendship',
        seedHint: 'friend',
      }).prompt
    );
    expect(p).toMatch(/bridge|lakeside|empathy|köprü kurucu|sunset/);
  });

  it('travel prompt discourages bean character (10D refinement)', () => {
    const visual = buildVisualPrompt({
      characterId: 'curiosity_exploration',
      characterName: 'Yolcu',
      personaFamilyId: 'curiosity_exploration',
      topicKey: 'travel',
      seedHint: 'travel',
    });
    const p = promptLower(visual.prompt);
    const neg = promptLower(visual.negativePrompt);
    expect(p).toMatch(/train station|historic|keşif|refined adult traveler/);
    expect(p).toContain('not round bean head');
    expect(p).toContain('not felt toy skin');
    expect(neg).toContain('bean head');
    expect(neg).toContain('round blob character');
  });

  it('Sprint 10G — architecture prompt uses premium stylized designer core', () => {
    const visual = buildVisualPrompt({
      characterId: 'clarity_simplification',
      characterName: 'Mekan Gözlemcisi',
      personaFamilyId: 'clarity_simplification',
      topicKey: 'architecture',
      seedHint: 'arch',
    });
    const p = promptLower(visual.prompt);
    const neg = promptLower(visual.negativePrompt);
    expect(p).toContain('premium stylized cinematic designer character');
    expect(p).toContain('not photorealistic');
    expect(p).toContain('not a real person');
    expect(p).toContain('premium stylized cinematic character');
    expect(p).toMatch(/25 to 35 percent/);
    expect(p).toContain('face softly stylized not photorealistic portrait');
    expect(neg).toContain('photorealistic portrait');
    expect(neg).toContain('corporate headshot');
    expect(visual.qualityHints.join(' ').toLowerCase()).toContain('premium stylized');
  });

  it('Sprint 11J — travel and finance use intent-first cinematic scenes', () => {
    const travel = promptLower(
      buildVisualPrompt({
        characterId: 'curiosity_exploration',
        characterName: 'Yolcu',
        personaFamilyId: 'curiosity_exploration',
        topicKey: 'travel',
        seedHint: 'travel',
      }).prompt
    );
    const finance = promptLower(
      buildVisualPrompt({
        characterId: 'decision_direction',
        characterName: 'Baykuş',
        personaFamilyId: 'decision_direction',
        topicKey: 'finance',
        seedHint: 'fin',
      }).prompt
    );
    expect(travel).toMatch(/train station|journey|horizon/);
    expect(travel).toContain('premium stylized cinematic character');
    expect(finance).toMatch(/research|decision|quiet research desk/);
    expect(finance).not.toContain('bilgeli baykuş');
    expect(finance).not.toContain('city terrace golden hour');
  });

  it('friendship human archetype avoids childlike face', () => {
    const p = promptLower(
      buildCharacterBiblePhrase(resolveCharacterArchetype('friendship'), 'Köprü Kurucu')
    );
    expect(p).toContain('not childlike face');
    expect(p).toContain('mature young adult');
  });

  it('all topics keep left overlay clean', () => {
    const topics = [
      'finance',
      'health',
      'friendship',
      'travel',
      'architecture',
      'creativity',
      'general',
    ] as const;
    for (const topicKey of topics) {
      const p = promptLower(
        buildVisualPrompt({
          characterId: 'balanced_calm',
          characterName: 'Test',
          personaFamilyId: 'balanced_calm',
          topicKey,
          seedHint: topicKey,
        }).prompt
      );
      expect(p).toContain('left upper and left-middle areas clean');
      if (topicKey === 'architecture') {
        expect(p).toContain('clean negative space on left');
        expect(p).toMatch(/premium stylized|stylized cinematic designer/);
      } else {
        expect(p).toMatch(/right or center-right|right side/);
      }
    }
  });

  it('buildCharacterBiblePhrase includes avoid rules', () => {
    const phrase = buildCharacterBiblePhrase(
      resolveCharacterArchetype('health'),
      'Şefkatli Geyik'
    );
    expect(phrase.toLowerCase()).toContain('avoid');
    expect(phrase.toLowerCase()).toContain('child plush');
  });

  it('Sprint 11G — calm panda archetype avoids plush mascot cues', () => {
    const phrase = buildCharacterBiblePhrase(
      resolveCharacterArchetype('architecture'),
      'Sakin Panda'
    ).toLowerCase();
    expect(phrase).toContain('mature stylized facial proportions');
    expect(phrase).toContain('not plush toy');
    expect(phrase).toContain('plush texture');
    expect(phrase).toContain('kawaii panda');
  });
});
