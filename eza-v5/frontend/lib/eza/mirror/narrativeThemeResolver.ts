/**
 * P4-A — Theme as pipeline result (cue rules + narrative core alignment).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { collectIntentCueBlob } from '@/lib/eza/mirror/intentLockSystem';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import { resolveDailyTheme, type DailyThemeResult } from '@/lib/eza/mirror/dailyThemeRegistry';
import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

const CORE_THEME_FALLBACK: Record<
  NarrativeCoreId,
  { title: string; subtitle: string }
> = {
  comparison: { title: 'Finansal Karar', subtitle: 'Plan, risk ve netlik' },
  exploration: { title: 'Keşif Yolculuğu', subtitle: 'Ufuk, merak ve yeni izler' },
  creation: { title: 'Yaratıcı Akış', subtitle: 'Fikir, ilham ve üretim' },
  care: { title: 'Sağlık & İyilik', subtitle: 'Ritim, beden ve denge' },
  uncertainty: { title: 'Finansal Karar', subtitle: 'Plan, risk ve netlik' },
  planning: { title: 'Günün Düşüncesi', subtitle: 'Sakin yansıma ve denge' },
  clarity: { title: 'Günün Düşüncesi', subtitle: 'Sakin yansıma ve denge' },
  trust: { title: 'İlişki & Bağ', subtitle: 'Empati, güven ve iletişim' },
  balance: { title: 'Günün Düşüncesi', subtitle: 'Sakin yansıma ve denge' },
  general_reflection: { title: 'Günün Düşüncesi', subtitle: 'Sakin yansıma ve denge' },
};

function cue(blob: string, patterns: string[]): boolean {
  return patterns.some((p) => blob.includes(p));
}

export function resolveNarrativeTheme(input: {
  entries: SavedBehavioralEntry[];
  storyTopicKey: SceneTopicKey;
  narrativeCoreId: NarrativeCoreId;
  lockedIntent: LockedPrimaryIntentId;
}): DailyThemeResult {
  const blob = collectIntentCueBlob(input.entries).toLowerCase();
  const fromCues = resolveDailyTheme(input.entries, input.storyTopicKey);

  if (input.lockedIntent === 'premium_vehicle_comparison') {
    return { dailyThemeTitle: 'Araç Kararı', dailyThemeSubtitle: 'Konfor, sürüş ve seçenekler' };
  }

  if (
    input.narrativeCoreId === 'comparison' &&
    cue(blob, ['bmw', 'mercedes', 'araç', 'otomobil', 'sedan', 'suv'])
  ) {
    return { dailyThemeTitle: 'Araç Kararı', dailyThemeSubtitle: 'Konfor, sürüş ve seçenekler' };
  }

  if (cue(blob, ['semerkant', 'samarkand', 'registan', 'buhara', 'hive'])) {
    return { dailyThemeTitle: 'Semerkant Yolculuğu', dailyThemeSubtitle: 'Rota, miras ve keşif' };
  }

  if (cue(blob, ['mimari', 'architecture', 'villa', 'restorasyon', 'cephe'])) {
    return { dailyThemeTitle: 'Mimari Tasarım', dailyThemeSubtitle: 'Mekân, form ve karar arayışı' };
  }

  if (fromCues.dailyThemeTitle !== 'Günün Düşüncesi') {
    return fromCues;
  }

  const fb = CORE_THEME_FALLBACK[input.narrativeCoreId] ?? CORE_THEME_FALLBACK.general_reflection;
  return { dailyThemeTitle: fb.title, dailyThemeSubtitle: fb.subtitle };
}
