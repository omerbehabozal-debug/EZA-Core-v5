import { describe, expect, it } from 'vitest';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import {
  FORBIDDEN_INTERNAL_LABELS,
  FORBIDDEN_PUBLIC_LANDING_PHRASES,
  buildPublicMirrorLandingFromInterpretation,
  isLegacyAntiSummaryLandingCopy,
  publicSummaryContainsForbiddenContent,
  SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import { migrateLegacyPublicLanding } from '@/lib/eza/mirror-network/migrateLegacyPublicLanding';
import { resolvePublishCuriosityBundle } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorCuriosityPipeline } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';

const MARDIN_INTERPRETATION: MirrorInterpretationV1 = {
  version: 'mirror-interpretation-v1',
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary:
    'Turistik rotalardan uzakta Mardin’in mahalle hissini ve sakin bir çay anını arıyor.',
  rationale: 'Local quiet street experience.',
  imageIntent: 'Quiet Mardin neighborhood curiosity away from tourist routes.',
  visualNarrative:
    'Sarı taşlı bir sokakta, çamaşır ipleri ve uzaktaki minareler arasında tahta sandalyede içilen sakin bir çay anı.',
  exclusions: ['modern buildings', 'tourist crowds'],
  confidence: 0.9,
  topicCategory: 'travel',
  atmosphereHint: 'serene and inviting',
};

const ARCH_INTERPRETATION: MirrorInterpretationV1 = {
  version: 'mirror-interpretation-v1',
  title: 'Cephe Işığında Malzeme',
  interpretationSummary:
    'Taş ve metal yüzeylerin ışıkla nasıl konuştuğunu merak eden bir mimari keşif.',
  rationale: 'Material and light study.',
  imageIntent: 'How facade materials carry emotion under evening light.',
  visualNarrative:
    'Akşam ışığında bir cephe kesitinde taş ve metal numuneleri, oran çizgileri ve yumuşak gölgeler.',
  confidence: 0.88,
  topicCategory: 'architecture',
};

describe('publicMirrorLanding v1', () => {
  it('Mardin travel interpretation invites curiosity without facade labels', () => {
    const landing = buildPublicMirrorLandingFromInterpretation(MARDIN_INTERPRETATION);
    expect(landing.publicTitle).toMatch(/Mardin/i);
    expect(landing.publicSummary).toMatch(/Mardin|yerel|mahalle|turist|sessiz|çay|sokak/i);
    expect(landing.publicSummary).not.toMatch(/^(Bu Mirror|This conversation)/i);
    for (const label of FORBIDDEN_INTERNAL_LABELS) {
      expect(landing.publicSummary).not.toContain(label);
    }
    for (const phrase of FORBIDDEN_PUBLIC_LANDING_PHRASES) {
      expect(landing.publicSummary.toLowerCase()).not.toContain(phrase);
    }
    expect(landing.continuationContext.length).toBeGreaterThan(20);
    expect(landing.contractVersion).toBe('mirror-public-landing-v1');
    expect(landing.semanticSource).toBe('d2_interpretation');
  });

  it('D2 curiosity bundle mirrors public landing into legacy context fields', () => {
    const built = buildCuriosityFromInterpretation(MARDIN_INTERPRETATION);
    expect(built.bundle.publicLanding?.publicSummary).toBe(built.bundle.curiosityContext.text);
    expect(built.bundle.landingContext).toBe(built.bundle.publicLanding?.publicSummary);
    expect(built.bundle.cardTitle).toBe(built.bundle.publicLanding?.publicTitle);
    expect(built.bundle.curiosityContext.text).not.toMatch(/Cephe malzemesi|Malzeme seçimi/);
    expect(built.bundle.curiosityContext.text).not.toMatch(/güvenli bir giriş kapısıdır/);
  });

  it('travel topic with architecture false-positive evidence cannot enter public copy', () => {
    const payload = {
      mirrorTitle: 'Akşam Rotası',
      mirrorText: 'internal',
      sceneMetaphor: 'street',
      topic: 'travel',
      storyTopicId: 'travel',
      safetyLevel: 'normal',
      conversationEvidence: [
        { label: 'Cephe malzemesi', visualHint: 'facade', importance: 90, source: 'active_conversation', role: 'primary' },
        { label: 'Malzeme seçimi', visualHint: 'samples', importance: 84, source: 'active_conversation', role: 'secondary' },
        { label: 'Işık ve gölge', visualHint: 'light', importance: 78, source: 'active_conversation', role: 'secondary' },
      ],
      pipelineVersion: 'v3',
      refinementVersion: '5.0',
    } as unknown as SainaMirrorV3Payload;

    const stale = buildMirrorCuriosityPipeline(payload);
    expect(stale.curiosityContext.text).toMatch(/Cephe malzemesi/);

    const card: DailyMirrorCardModel = {
      date: '2026-07-25',
      dayLabel: '25 Temmuz',
      headline: 'Akşam Rotası',
      characterName: 'biligN',
      personaFamilyId: 'balanced_calm',
      shortInsight: '',
      userLine: '',
      aiLine: '',
      balanceLine: '',
      signalLevel: '',
      confidence: '',
      energyLabel: '',
      energyScore: null,
      shareEnabled: true,
      privacyText: '',
      visual: {
        prompt: 'VISUAL NARRATIVE:\nMardin yellow stone',
        negativePrompt: 'text',
        seedHint: 'mardin',
        stylePreset: 'eza_mirror_professional_v1',
        qualityHints: [],
        promptContract: MIRROR_V5_PROMPT_CONTRACT,
        topicLabel: 'travel',
      },
      mirrorV3Payload: { ...payload, curiosityBundle: stale },
      mirrorFinalInterpretation: MARDIN_INTERPRETATION,
      mirrorShare: {
        blueprint: buildShareBlueprint(stale, 'travel'),
        shareVoice: stale.shareVoice!,
        shareUrl: null,
      },
    };

    const resolved = resolvePublishCuriosityBundle(card);
    expect(resolved.semanticSource).toBe('d2_interpretation');
    expect(resolved.bundle.publicLanding?.publicSummary).not.toMatch(/Cephe malzemesi/);
    expect(resolved.bundle.curiosityContext.text).not.toMatch(/Malzeme seçimi|Işık ve gölge/);
  });

  it('missing finalInterpretation uses safe fallback without evidence labels', () => {
    const payload = {
      mirrorTitle: 'Akşam Rotası',
      mirrorText: 'internal',
      sceneMetaphor: 'street',
      topic: 'travel',
      storyTopicId: 'travel',
      safetyLevel: 'normal',
      conversationEvidence: [
        { label: 'Cephe malzemesi', visualHint: 'facade', importance: 90, source: 'active_conversation', role: 'primary' },
      ],
      pipelineVersion: 'v3',
      refinementVersion: '5.0',
    } as unknown as SainaMirrorV3Payload;
    const stale = buildMirrorCuriosityPipeline(payload);
    const card: DailyMirrorCardModel = {
      date: '2026-07-25',
      dayLabel: '25 Temmuz',
      headline: 'Akşam Rotası',
      characterName: 'biligN',
      personaFamilyId: 'balanced_calm',
      shortInsight: '',
      userLine: '',
      aiLine: '',
      balanceLine: '',
      signalLevel: '',
      confidence: '',
      energyLabel: '',
      energyScore: null,
      shareEnabled: true,
      privacyText: '',
      visual: {
        prompt: 'x',
        negativePrompt: 'text',
        seedHint: 'x',
        stylePreset: 'eza_mirror_professional_v1',
        qualityHints: [],
        promptContract: MIRROR_V5_PROMPT_CONTRACT,
        topicLabel: 'travel',
      },
      mirrorV3Payload: { ...payload, curiosityBundle: stale },
      mirrorShare: {
        blueprint: buildShareBlueprint(stale, 'travel'),
        shareVoice: stale.shareVoice!,
        shareUrl: null,
      },
    };

    const resolved = resolvePublishCuriosityBundle(card);
    expect(resolved.semanticSource).toBe('safe_fallback');
    expect(resolved.bundle.publicLanding?.publicSummary).toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
    expect(resolved.bundle.curiosityContext.text).not.toMatch(/Cephe malzemesi/);
    expect(resolved.bundle.seed.subtopics).toEqual([]);
  });

  it('architecture interpretation may mention materials in prose without copying labels', () => {
    const landing = buildPublicMirrorLandingFromInterpretation(ARCH_INTERPRETATION);
    expect(landing.publicSummary.toLowerCase()).toMatch(/taş|metal|cephe|ışık|malzeme/);
    expect(landing.publicSummary).not.toContain('Cephe malzemesi');
    expect(landing.publicSummary).not.toContain('Malzeme seçimi');
    expect(publicSummaryContainsForbiddenContent(landing.publicSummary)).toBe(false);
  });

  it('legacy migration rebuilds from D2 and strips anti-summary template', () => {
    const legacy =
      'Bu merak alanı, Cephe malzemesi, Malzeme seçimi, Işık ve gölge üzerine doğmuş bir keşif izinden ilham alır; güvenli bir giriş kapısıdır, konuşmayı yeniden anlatmaz.';
    expect(isLegacyAntiSummaryLandingCopy(legacy)).toBe(true);

    const migrated = migrateLegacyPublicLanding({
      curiosityContext: legacy,
      cardTitle: 'Akşam Rotası',
      finalInterpretation: MARDIN_INTERPRETATION,
    });
    expect(migrated.migrated).toBe(true);
    expect(migrated.reason).toBe('d2_rebuild');
    expect(migrated.publicLanding.publicSummary).not.toMatch(/Cephe malzemesi/);
    expect(migrated.audit.previousHadAntiSummaryTemplate).toBe(true);
  });

  it('legacy migration without D2 uses safe fallback', () => {
    const legacy =
      'Bu merak alanı, Cephe malzemesi üzerine doğmuş bir keşif izinden ilham alır; güvenli bir giriş kapısıdır, konuşmayı yeniden anlatmaz.';
    const migrated = migrateLegacyPublicLanding({
      curiosityContext: legacy,
      cardTitle: 'Akşam Rotası',
    });
    expect(migrated.reason).toBe('safe_fallback');
    expect(migrated.publicLanding.publicSummary).toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
  });
});
