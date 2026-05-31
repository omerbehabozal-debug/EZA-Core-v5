/**
 * Onboarding preview data — gerçek kart pipeline ile eşleştirme için saklanır.
 * UI şu an statik görsel kullanıyor: copy.ts → MIRROR_ONBOARDING_PREVIEW_IMAGE
 */

import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';

/** Hedef poster içeriği (gelecek sprint wiring). */
export const ONBOARDING_PREVIEW_CARD: DailyMirrorCardModel = {
  date: '2026-05-31',
  dayLabel: 'Bugün',
  headline: 'Lezzetli & Sağlıklı Bir Gün',
  characterName: 'Lezzetli & Sağlıklı',
  personaFamilyId: 'ideation_creation',
  shortInsight: 'Yaratıcı, özenli ve bilinçli seçimler.',
  dailyJourney: 'Bugünkü AI İlişki Aynan',
  mirrorStory:
    'Glutensiz tatlı tarifleri arayarak kendine ve sevdiklerine tatlı bir iyilik yaptın. AI ile birlikte yaratıcı, özenli ve bilinçli seçimler yaptınız.',
  userLine: 'Tarif araştırdın',
  aiLine: 'Alternatifler sundu',
  balanceLine: 'Sağlıklı ritim',
  signalLevel: 'medium',
  confidence: 'medium',
  energyLabel: 'Yüksek Odak',
  energyScore: 81,
  shareEnabled: true,
  privacyText: 'Önizleme — gerçek kart değildir.',
  reflectionTone: 'focused_growth',
  themeDescription: 'Yaratıcılık & Özen',
  quote: 'İyi seçimler, küçük tariflerle büyük mutluluklar yaratır.',
  tomorrowHint: 'Sorularını biraz daha sadeleştir.',
  renderMode: 'scene_only',
  visual: {
    characterId: 'ideation_creation_preview',
    characterName: 'Lezzetli & Sağlıklı',
    personaFamilyId: 'ideation_creation',
    topicLabel: 'genel düşünce',
    atmosphereLabel: 'sakin',
    emotionLabel: 'odaklı',
    prompt: '',
    negativePrompt: '',
    stylePreset: 'eza_mirror_professional_v1',
    seedHint: 'mirror-onboarding-preview',
    renderMode: 'scene_only',
    sceneImageStatus: 'idle',
  },
};

export const ONBOARDING_PREVIEW_META: MirrorStateMeta = {
  hasEnoughData: true,
  sampleCount: 5,
  source: 'local_history',
  generatedAt: '2026-05-31T00:00:00.000Z',
  warnings: [],
};
