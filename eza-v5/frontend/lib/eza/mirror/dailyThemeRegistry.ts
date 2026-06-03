/**
 * Daily Mirror — user-facing daily theme from topic + behavioral cues (P0).
 * No invented place names without cue evidence.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { collectIntentCueBlob } from '@/lib/eza/mirror/intentLockSystem';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import { SCENE_TOPIC_LABEL } from '@/lib/eza/mirror/visualPromptPresets';

export type DailyThemeResult = {
  dailyThemeTitle: string;
  dailyThemeSubtitle: string;
};

type ThemeRule = {
  id: string;
  title: string;
  subtitle: string;
  topicKeys?: SceneTopicKey[];
  /** All patterns must appear in normalized cue blob */
  cueAll?: string[];
  /** At least one pattern must appear */
  cueAny?: string[];
};

const THEME_RULES: ThemeRule[] = [
  {
    id: 'samarkand_journey',
    title: 'Semerkant Yolculuğu',
    subtitle: 'Rota, miras ve keşif',
    topicKeys: ['travel'],
    cueAny: ['semerkant', 'samarkand', 'registan', 'özbek', 'uzbek'],
  },
  {
    id: 'architecture_design',
    title: 'Mimari Tasarım',
    subtitle: 'Mekân, form ve karar arayışı',
    topicKeys: ['architecture'],
    cueAny: ['mimari', 'architecture', 'villa', 'restorasyon', 'restoration', 'yapı', 'plan'],
  },
  {
    id: 'financial_decision',
    title: 'Finansal Karar',
    subtitle: 'Plan, risk ve netlik',
    topicKeys: ['finance'],
    cueAny: ['finans', 'finance', 'bütçe', 'budget', 'yatırım', 'invest'],
  },
  {
    id: 'health_wellness',
    title: 'Sağlık & İyilik',
    subtitle: 'Ritim, beden ve denge',
    topicKeys: ['health'],
    cueAny: ['sağlık', 'health', 'wellness', 'iyi oluş', 'fitness'],
  },
  {
    id: 'product_strategy',
    title: 'Ürün Stratejisi',
    subtitle: 'Yön, öncelik ve netlik',
    cueAny: ['ürün', 'product', 'strateji', 'strategy', 'roadmap', 'feature', 'mvp'],
  },
  {
    id: 'vehicle_decision',
    title: 'Araç Kararı',
    subtitle: 'Konfor, sürüş ve seçenekler',
    cueAny: ['bmw', 'mercedes', 'audi', 'araç', 'otomobil', 'sedan', 'suv', 'konfor'],
  },
  {
    id: 'friendship_connection',
    title: 'İlişki & Bağ',
    subtitle: 'Empati, güven ve iletişim',
    topicKeys: ['friendship'],
    cueAny: ['arkadaş', 'friend', 'ilişki', 'relationship', 'empati'],
  },
  {
    id: 'creative_flow',
    title: 'Yaratıcı Akış',
    subtitle: 'Fikir, ilham ve üretim',
    topicKeys: ['creativity'],
    cueAny: ['yaratı', 'creative', 'tasarım', 'design', 'ilham'],
  },
  {
    id: 'travel_exploration',
    title: 'Keşif Yolculuğu',
    subtitle: 'Ufuk, merak ve yeni izler',
    topicKeys: ['travel'],
    cueAny: ['seyahat', 'travel', 'gezi', 'yolculuk', 'keşif', 'explore'],
  },
];

const TOPIC_FALLBACK: Record<
  SceneTopicKey,
  { title: string; subtitle: string }
> = {
  health: { title: 'Sağlık & İyilik', subtitle: 'Ritim ve iyi oluş' },
  finance: { title: 'Finansal Karar', subtitle: 'Plan ve denge' },
  friendship: { title: 'İlişki & Bağ', subtitle: 'Empati ve güven' },
  travel: { title: 'Keşif Yolculuğu', subtitle: 'Ufuk ve merak' },
  architecture: { title: 'Mimari Tasarım', subtitle: 'Mekân ve netlik' },
  creativity: { title: 'Yaratıcı Akış', subtitle: 'İlham ve fikir' },
  general: { title: 'Günün Düşüncesi', subtitle: 'Sakin yansıma ve denge' },
};

function normalizeBlob(blob: string): string {
  return blob.toLowerCase();
}

function ruleMatches(rule: ThemeRule, blob: string, topicKey: SceneTopicKey): boolean {
  if (rule.topicKeys?.length && !rule.topicKeys.includes(topicKey)) {
    return false;
  }
  if (rule.cueAll?.length) {
    if (!rule.cueAll.every((c) => blob.includes(c))) return false;
  }
  if (rule.cueAny?.length) {
    if (!rule.cueAny.some((c) => blob.includes(c))) return false;
  }
  if (!rule.cueAll?.length && !rule.cueAny?.length) {
    return false;
  }
  return true;
}

function topicFallback(topicKey: SceneTopicKey): DailyThemeResult {
  const fb = TOPIC_FALLBACK[topicKey] ?? TOPIC_FALLBACK.general;
  return {
    dailyThemeTitle: fb.title,
    dailyThemeSubtitle: fb.subtitle,
  };
}

/**
 * Resolve daily theme from entries + story topic (deterministic, cue-safe).
 */
export function resolveDailyTheme(
  entries: SavedBehavioralEntry[],
  storyTopicKey: SceneTopicKey
): DailyThemeResult {
  const blob = normalizeBlob(collectIntentCueBlob(entries));

  for (const rule of THEME_RULES) {
    if (ruleMatches(rule, blob, storyTopicKey)) {
      return {
        dailyThemeTitle: rule.title,
        dailyThemeSubtitle: rule.subtitle,
      };
    }
  }

  const topicOnly = THEME_RULES.find(
    (r) => r.topicKeys?.includes(storyTopicKey) && !r.cueAny?.length && !r.cueAll?.length
  );
  if (topicOnly) {
    return {
      dailyThemeTitle: topicOnly.title,
      dailyThemeSubtitle: topicOnly.subtitle,
    };
  }

  const label = SCENE_TOPIC_LABEL[storyTopicKey];
  const fb = topicFallback(storyTopicKey);
  return {
    dailyThemeTitle: fb.dailyThemeTitle,
    dailyThemeSubtitle: fb.dailyThemeSubtitle || label,
  };
}
