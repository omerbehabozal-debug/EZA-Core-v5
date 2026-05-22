/**
 * EZA Mirror — editorial journey headlines (Sprint 11G).
 * “Günün hissi” — not category labels; rule-based, no message content.
 */

import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { MicroMoodId, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

const BY_MOOD: Record<MicroMoodId, readonly string[]> = {
  clarifying: [
    'Sakinleş ve Netleştir',
    'Ölçülü Düşün',
    'Düşünerek Yaklaş',
    'Sessiz Netlik',
  ],
  comparing: [
    'Yan Yana Bak',
    'Karar Öncesi Sessizlik',
    'Seçenekleri Tart',
    'Küçük Netlikler',
  ],
  cautious_curiosity: [
    'Temkinli İlerleyiş',
    'Merak ve Özen',
    'Yavaşlayan Zihin',
    'Hisseterek İlerle',
  ],
  calm_analysis: [
    'Sessiz Netlik',
    'Sakinleş ve Netleştir',
    'Ölçülü Düşün',
    'Durgun Açıklık',
  ],
  tired_thinking: [
    'Yavaşlayan Zihin',
    'Sakin Tempo',
    'İçe Dönük Sessizlik',
    'Hafif Yorgunluk',
  ],
  gentle_retry: [
    'Yeniden Dene',
    'Küçük Düzeltme',
    'Yumuşak Adım',
    'Sakinleş ve Netleştir',
  ],
  detail_study: [
    'Detayda Dur',
    'Sakin Ustalık',
    'Ölçülü Düşün',
    'Küçük Netlikler',
  ],
  quiet_exploration: [
    'Ufuk Aç',
    'Hafif Keşif',
    'İhtimal Hissi',
    'Düşünerek Yaklaş',
  ],
  measured_decision: [
    'Kontrollü İlerleyiş',
    'Karar Öncesi Sessizlik',
    'Sessiz Netlik',
    'Ölçülü Düşün',
  ],
  soft_openness: [
    'Yumuşak Açıklık',
    'Sakinleş ve Netleştir',
    'Temkinli İlerleyiş',
    'Hisseterek İlerle',
  ],
  balanced_tempo: [
    'Sakin Tempo',
    'Dengeli Ritim',
    'Sessiz Netlik',
    'Ölçülü Düşün',
  ],
};

const BY_VARIANT: Partial<Record<TopicStoryVariantId, readonly string[]>> = {
  compare: ['Karar Öncesi Sessizlik', 'Yan Yana Bak', 'Küçük Netlikler'],
  clarify: ['Sakinleş ve Netleştir', 'Sessiz Netlik', 'Ölçülü Düşün'],
  caution: ['Temkinli İlerleyiş', 'Merak ve Özen', 'Hisseterek İlerle'],
  control: ['Kontrollü İlerleyiş', 'Doğru His', 'Sessiz Netlik'],
  simplify: ['Sadeleş ve Netleş', 'Küçük Netlikler', 'Sakin Tempo'],
  discovery: ['Ufuk Aç', 'Hafif Keşif', 'İhtimal Hissi'],
  possibility: ['İhtimal Hissi', 'Ufuk Aç', 'Düşünerek Yaklaş'],
  reflective_path: ['İç Yolculuk', 'Yavaşlayan Zihin', 'Sessiz Netlik'],
  planning: ['Adım Adım', 'Kontrollü İlerleyiş', 'Ölçülü Düşün'],
  nourish: ['Özenli Seçim', 'Sakin Tempo', 'Yumuşak Bakım'],
  repair: ['Yumuşak Bağ', 'Hisseterek İlerle', 'Sakinleş ve Netleştir'],
  craft: ['Sakin Ustalık', 'Detayda Dur', 'Ölçülü Düşün'],
  flow: ['Sakin Akış', 'Sessiz Netlik', 'Hafif İlham'],
  stillness: ['Sakin Tempo', 'Yavaşlayan Zihin', 'İçe Dönük Sessizlik'],
};

const BY_TOPIC: Partial<Record<SceneTopicKey, readonly string[]>> = {
  finance: ['Karar Öncesi Sessizlik', 'Sakinleş ve Netleştir', 'Kontrollü İlerleyiş'],
  travel: ['Ufuk Aç', 'İhtimal Hissi', 'Hafif Keşif'],
  health: ['Özenli Seçim', 'Yumuşak Bakım', 'Sakin Tempo'],
  friendship: ['Yumuşak Bağ', 'Hisseterek İlerle', 'Sakinleş ve Netleştir'],
  architecture: ['Sakin Ustalık', 'Detayda Dur', 'Ölçülü Düşün'],
  creativity: ['Hafif İlham', 'Sakin Akış', 'Sessiz Netlik'],
  general: ['Sessiz Netlik', 'Sakin Tempo', 'Ölçülü Düşün'],
};

const VEHICLE_COMPARISON_HEADLINES = [
  'Kıyasla ve Netleştir',
  'Konforu Seç',
  'İki Seçenek, Net Bir Yol',
  'Karar Öncesi Netlik',
] as const;

const FALLBACK = ['Sessiz Netlik', 'Sakin Tempo', 'Ölçülü Düşün', 'Sakinleş ve Netleştir'] as const;

function hashPick(seed: string, items: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 23)) | 0;
  }
  return items[Math.abs(h) % items.length]!;
}

export function composeEditorialHeadline(
  microMood: MicroMoodId,
  variant: TopicStoryVariantId,
  topic: SceneTopicKey,
  seed: string,
  lockedIntent?: LockedPrimaryIntentId
): string {
  if (lockedIntent === 'premium_vehicle_comparison') {
    return hashPick(`${seed}-vehicle-lock`, VEHICLE_COMPARISON_HEADLINES);
  }
  const pool = [
    ...(BY_VARIANT[variant] ?? []),
    ...(BY_MOOD[microMood] ?? []),
    ...(BY_TOPIC[topic] ?? []),
    ...FALLBACK,
  ];
  const unique = Array.from(new Set(pool));
  return hashPick(`${seed}-ed-${microMood}-${variant}-${topic}`, unique);
}
