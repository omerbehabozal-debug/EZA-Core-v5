/**
 * Contextual highlight band — poster presentation (Sprint 11K).
 * Binds conversation visual intent to on-card context (no chat logs).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { ConversationVisualIntentId } from '@/lib/eza/mirror/conversationVisualIntent';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import { extractVehicleHighlightLabels } from '@/lib/eza/mirror/intentLockSystem';

export type ContextualHighlightKind = 'dual_comparison' | 'tag_focus' | 'triple_tags';

export type ContextualHighlightSide = {
  label: string;
  hint: string;
};

export type ContextualHighlight = {
  kind: ContextualHighlightKind;
  bandTitle: string;
  left?: ContextualHighlightSide;
  right?: ContextualHighlightSide;
  centerBadge?: string;
  tags: string[];
};

const INTENT_TO_HIGHLIGHT: Partial<
  Record<ConversationVisualIntentId, Omit<ContextualHighlight, 'kind'> & { kind: ContextualHighlightKind }>
> = {
  premium_vehicle_comparison: {
    kind: 'dual_comparison',
    bandTitle: 'Karar öncesi',
    left: { label: 'Seçenek A', hint: 'Konfor & uzun yol' },
    right: { label: 'Seçenek B', hint: 'Denge & kalite' },
    centerBadge: 'VS',
    tags: ['Konfor önceliği', 'Kıyas', 'Netlik'],
  },
  product_comparison: {
    kind: 'dual_comparison',
    bandTitle: 'Seçenekler',
    left: { label: 'Seçenek A', hint: 'Öne çıkan artılar' },
    right: { label: 'Seçenek B', hint: 'Denge & uzun vade' },
    centerBadge: 'VS',
    tags: ['Karşılaştır', 'Netleştir'],
  },
  financial_decision: {
    kind: 'tag_focus',
    bandTitle: 'Netlik & Kontrol',
    tags: ['Bütçe', 'Risk', 'Karar', 'Denge'],
  },
  culinary_wellness: {
    kind: 'tag_focus',
    bandTitle: 'Özenli Seçimler',
    tags: ['Doğal malzeme', 'Hafif tarif', 'Ritim'],
  },
  restoration_research: {
    kind: 'triple_tags',
    bandTitle: 'Malzeme & Ustalık',
    tags: ['Taş & harç', 'Dayanıklılık', 'Uygulama'],
  },
  travel_planning: {
    kind: 'tag_focus',
    bandTitle: 'Rota & Keşif',
    tags: ['Rota', 'Zaman', 'Deneyim'],
  },
  friendship_reflection: {
    kind: 'tag_focus',
    bandTitle: 'Bağ & İletişim',
    tags: ['Empati', 'Konuşma', 'Çözüm'],
  },
  creative_brainstorm: {
    kind: 'tag_focus',
    bandTitle: 'Fikir & Akış',
    tags: ['İlham', 'Taslak', 'Netlik'],
  },
  deep_research: {
    kind: 'tag_focus',
    bandTitle: 'Derinlemesine Bakış',
    tags: ['Detay', 'Anlam', 'Yapı'],
  },
  wellness_calm: {
    kind: 'tag_focus',
    bandTitle: 'İyi Oluş',
    tags: ['Ritim', 'Özen', 'Denge'],
  },
};

const TOPIC_FALLBACK: Record<
  SceneTopicKey,
  Omit<ContextualHighlight, 'kind'> & { kind: ContextualHighlightKind }
> = {
  finance: {
    kind: 'tag_focus',
    bandTitle: 'Plan & Denge',
    tags: ['Bütçe', 'Karar', 'Netlik'],
  },
  health: {
    kind: 'tag_focus',
    bandTitle: 'Sağlık & Ritim',
    tags: ['Özen', 'Denge', 'Bakım'],
  },
  friendship: {
    kind: 'tag_focus',
    bandTitle: 'Bağ & İletişim',
    tags: ['Empati', 'Güven', 'Uyum'],
  },
  travel: {
    kind: 'tag_focus',
    bandTitle: 'Keşif & Ufuk',
    tags: ['Rota', 'Merak', 'Tempo'],
  },
  architecture: {
    kind: 'triple_tags',
    bandTitle: 'Yapı & Malzeme',
    tags: ['Form', 'Doku', 'Işık'],
  },
  creativity: {
    kind: 'tag_focus',
    bandTitle: 'İlham & Yaratım',
    tags: ['Fikir', 'Renk', 'Akış'],
  },
  general: {
    kind: 'tag_focus',
    bandTitle: 'Günün Odağı',
    tags: ['Düşünce', 'Netlik', 'Tempo'],
  },
};

function mapIntentIdFromLabel(label?: string): ConversationVisualIntentId | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes('car comparison') || l.includes('vehicle')) return 'premium_vehicle_comparison';
  if (l.includes('product comparison')) return 'product_comparison';
  if (l.includes('culinary') || l.includes('cooking')) return 'culinary_wellness';
  if (l.includes('restoration') || l.includes('heritage')) return 'restoration_research';
  if (l.includes('journey') || l.includes('travel')) return 'travel_planning';
  if (l.includes('friendship') || l.includes('connection')) return 'friendship_reflection';
  if (l.includes('financial') || l.includes('decision')) return 'financial_decision';
  return null;
}

function compareHighlightFromCard(card: DailyMirrorCardModel): ContextualHighlight | null {
  if (card.storyVariant !== 'compare') return null;
  const topic = card.storyTopicKey ?? 'general';
  if (topic === 'finance') {
    return {
      kind: 'dual_comparison',
      bandTitle: 'Netlik & Kontrol',
      left: { label: 'Seçenek A', hint: 'Kısa vadeli netlik' },
      right: { label: 'Seçenek B', hint: 'Uzun vadeli denge' },
      centerBadge: 'VS',
      tags: ['Bütçe', 'Risk'],
    };
  }
  return {
    kind: 'dual_comparison',
    bandTitle: 'Kıyas',
    left: { label: 'Yol A', hint: 'Bugünkü his' },
    right: { label: 'Yol B', hint: 'Alternatif ufuk' },
    centerBadge: 'VS',
    tags: ['Netleştir'],
  };
}

function vehicleCueBlobFromCard(card: DailyMirrorCardModel): string {
  return [
    card.userLine,
    card.aiLine,
    card.mirrorStory,
    card.dailyJourney,
    card.headline,
    card.shortInsight,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function applyVehicleLabels(
  base: ContextualHighlight,
  card: DailyMirrorCardModel
): ContextualHighlight {
  const labels = extractVehicleHighlightLabels(vehicleCueBlobFromCard(card));
  if (!labels || base.kind !== 'dual_comparison') return base;
  return {
    ...base,
    left: { label: labels.left, hint: 'Konfor & uzun yol' },
    right: { label: labels.right, hint: 'Denge & kalite' },
  };
}

export function buildContextualHighlight(card: DailyMirrorCardModel): ContextualHighlight {
  const intentId = mapIntentIdFromLabel(card.visual?.sceneIntentLabel);

  if (intentId && INTENT_TO_HIGHLIGHT[intentId]) {
    const base = { ...INTENT_TO_HIGHLIGHT[intentId]! };
    if (intentId === 'premium_vehicle_comparison') {
      return applyVehicleLabels(base, card);
    }
    return base;
  }

  const fromCompare = compareHighlightFromCard(card);
  if (fromCompare) return fromCompare;

  const topic = card.storyTopicKey ?? 'general';
  const base = TOPIC_FALLBACK[topic] ?? TOPIC_FALLBACK.general;

  return {
    ...base,
    tags: base.tags.slice(0, 3),
  };
}
