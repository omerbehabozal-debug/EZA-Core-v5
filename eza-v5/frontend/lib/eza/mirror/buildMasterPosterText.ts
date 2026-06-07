/**
 * Master poster text — EZA-controlled headline/quote for OpenAI composition.
 */

import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { StoryTopicResolution } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { MasterPosterText } from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  MASTER_POSTER_HEADLINE_MAX,
  MASTER_POSTER_QUOTE_MAX,
} from '@/lib/eza/mirror/sceneSubtopicTypes';

const PHONE_PATTERN = /(\+?\d[\d\s().-]{8,}\d)/;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const RAW_CHAT_PATTERNS = [
  /\bsordun\b/i,
  /\bne yiyebilirim\b/i,
  /\bşunu\b/i,
  /\bbunu\b/i,
];

const SUBTOPIC_HEADLINE_FALLBACK: Record<SceneSubtopicId, string> = {
  travel_silk_road: 'İpek Yolu Sohbeti',
  travel_samarkand: 'Semerkant İzleri',
  travel_bukhara: 'Buhara Kapıları',
  travel_uzbekistan: 'Özbekistan Rotası',
  travel_generic_journey: 'Yolculuk Anı',
  arch_mosque_heritage: 'Taşın Hafızası',
  arch_facade_restoration: 'Cephe İzleri',
  arch_material_study: 'Restorasyon Masası',
  vehicle_luxury_sedan_comparison: 'Sessiz Karar Anı',
  vehicle_suv_comparison: 'SUV Karşılaştırması',
  vehicle_ev_comparison: 'Elektrikli Seçim',
  tech_coding_ai: 'Kod ve Işık',
  tech_product_building: 'Ürünün Eşiğinde',
  tech_startup_strategy: 'Platform Vizyonu',
  topic_generic: 'Günün Aynası',
};

const SUBTOPIC_QUOTE_FALLBACK: Partial<Record<SceneSubtopicId, string>> = {
  travel_silk_road: 'Mavi çiniler ve kervan yolları bugünün sohbetini taşıdı.',
  travel_samarkand: 'Registan ışığında küçük bir keşif hissi kaldı.',
  arch_mosque_heritage: 'Taş, geometri ve sabır aynı masada buluştu.',
  vehicle_luxury_sedan_comparison: 'Konfor ile karakter arasında ölçülü bir karar vardı.',
  tech_product_building: 'Fikirler bugün daha görünür bir ürün çizgisine yaklaştı.',
};

export type BuildMasterPosterTextInput = {
  dailyJourney?: string;
  headline?: string;
  quote?: string;
  mirrorMoment?: string;
  dailyThemeTitle?: string;
  tomorrowHint?: string;
  themeDescription?: string;
  storyTopicResolution?: StoryTopicResolution;
  sceneSubtopicResolution?: SceneSubtopicResolution;
};

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sanitizePosterFragment(text: string, maxLen: number): string {
  let t = collapseWhitespace(text);
  t = t.replace(PHONE_PATTERN, '');
  t = t.replace(EMAIL_PATTERN, '');
  for (const pat of RAW_CHAT_PATTERNS) {
    if (pat.test(t)) return '';
  }
  if (t.length > maxLen) {
    const slice = t.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(' ');
    t = lastSpace > 12 ? slice.slice(0, lastSpace) : slice;
  }
  return collapseWhitespace(t);
}

function pickHeadline(input: BuildMasterPosterTextInput, subtopic: SceneSubtopicId): string {
  const candidates = [
    input.dailyJourney,
    input.headline,
    input.dailyThemeTitle,
    input.mirrorMoment,
  ];
  for (const c of candidates) {
    const safe = sanitizePosterFragment(c ?? '', MASTER_POSTER_HEADLINE_MAX);
    if (safe.length >= 4) return safe;
  }
  return SUBTOPIC_HEADLINE_FALLBACK[subtopic] ?? SUBTOPIC_HEADLINE_FALLBACK.topic_generic;
}

function pickQuote(input: BuildMasterPosterTextInput, subtopic: SceneSubtopicId): string {
  const candidates = [
    input.quote,
    input.themeDescription,
    input.tomorrowHint,
    input.mirrorMoment,
  ];
  for (const c of candidates) {
    const safe = sanitizePosterFragment(c ?? '', MASTER_POSTER_QUOTE_MAX);
    if (safe.length >= 8) return safe;
  }
  return (
    SUBTOPIC_QUOTE_FALLBACK[subtopic] ??
    'Bugünün sohbeti sakin bir görsel iz bıraktı.'
  );
}

export function buildMasterPosterText(
  input: BuildMasterPosterTextInput
): MasterPosterText {
  const resolvedSubtopic =
    input.sceneSubtopicResolution?.primarySubtopic ?? 'topic_generic';

  return {
    headline: pickHeadline(input, resolvedSubtopic),
    quote: pickQuote(input, resolvedSubtopic),
  };
}

/** Convenience wrapper for mirror state pipeline. */
export function buildMasterPosterTextFromCardFields(input: {
  dailyJourney?: string;
  headline?: string;
  quote?: string;
  mirrorMoment?: string;
  dailyThemeTitle?: string;
  tomorrowHint?: string;
  themeDescription?: string;
  storyTopicResolution: StoryTopicResolution;
  sceneSubtopicResolution: SceneSubtopicResolution;
}): MasterPosterText {
  return buildMasterPosterText(input);
}
