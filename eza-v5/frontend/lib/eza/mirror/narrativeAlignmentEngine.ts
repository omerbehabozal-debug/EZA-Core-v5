/**
 * Narrative Alignment Engine — subtopic-first master poster copy.
 * Priority: SceneSubtopic → StoryTopic → narrative fallback.
 */

import type { SceneSubtopicId, SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { StoryTopicId, StoryTopicResolution } from '@/lib/eza/mirror/storyTopicTypes';
import type { MasterPosterText } from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  MASTER_POSTER_HEADLINE_MAX,
  MASTER_POSTER_QUOTE_MAX,
} from '@/lib/eza/mirror/sceneSubtopicTypes';

export const SUBTOPIC_HEADLINE_CONFIDENCE_MIN = 0.65;

const PHONE_PATTERN = /(\+?\d[\d\s().-]{8,}\d)/;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const RAW_CHAT_PATTERNS = [
  /\bsordun\b/i,
  /\bne yiyebilirim\b/i,
  /\bşunu\b/i,
  /\bbunu\b/i,
];

export const SUBTOPIC_ALIGNED_HEADLINE: Record<SceneSubtopicId, string> = {
  travel_silk_road: 'İpek Yolu Sohbeti',
  travel_samarkand: "Registan'ın Gölgesinde",
  travel_bukhara: 'Buhara Akşamı',
  travel_uzbekistan: 'İpek Yolu Sohbeti',
  travel_spain: 'İberya İzleri',
  travel_andalusia: 'Endülüs Işığı',
  travel_mardin: 'Mardin Terasları',
  travel_generic_journey: 'Yolculuk Anı',
  arch_mosque_heritage: 'Kubbelerin Hafızası',
  arch_mardin_heritage: 'Taş Teraslar',
  arch_mardin_stone: 'Kiremetin İzi',
  arch_vault_study: 'Tonoz Masası',
  arch_facade_restoration: 'Taşın Hafızası',
  arch_material_study: 'Restorasyon Masası',
  vehicle_luxury_sedan_comparison: 'Konfor Karşılaştırması',
  vehicle_suv_comparison: 'Yüksekten Bakış',
  vehicle_ev_comparison: 'Elektrikli Seçim',
  tech_coding_ai: 'Kod ve Fikir',
  tech_product_building: 'Ürünün Eşiğinde',
  tech_startup_strategy: 'Büyük Resim',
  topic_generic: 'Günün Aynası',
};

export const SUBTOPIC_ALIGNED_QUOTE: Record<SceneSubtopicId, string> = {
  travel_silk_road: 'Mavi çiniler ve kervan yolları bugünün sohbetini taşıdı.',
  travel_samarkand: 'Registan ışığında küçük bir keşif hissi kaldı.',
  travel_bukhara: 'Eski şehir kapılarında sakin bir akşam izi vardı.',
  travel_uzbekistan: 'İpek Yolu üzerinde geniş bir rota hayali kuruldu.',
  travel_spain: 'İspanya rotasında sıcak taş ve açık bir ufuk vardı.',
  travel_andalusia: 'Endülüs ışığında taş ve kemerler sakin bir keşif hissi bıraktı.',
  travel_mardin: 'Mardin teraslarında taş şehrin izi görünür oldu.',
  travel_generic_journey: 'Yeni bir rota seçmek için sakin bir merak vardı.',
  arch_mosque_heritage: 'Kubbe, cephe ve taşın hafızası aynı masada buluştu.',
  arch_mardin_heritage: 'Avlulu taş evlerde geçmiş ile bugün yan yana durdu.',
  arch_mardin_stone: 'Kiremit taş ve cephe detayları ölçülü bir çalışma istedi.',
  arch_vault_study: 'Tonoz ve kemer için sakin bir yapısal çalışma vardı.',
  arch_facade_restoration: 'Cephe taşlarında geçmiş ile bugün yan yana durdu.',
  arch_material_study: 'Malzeme ve restorasyon için ölçülü bir çalışma vardı.',
  vehicle_luxury_sedan_comparison: 'Konfor ile karakter arasında ölçülü bir karar vardı.',
  vehicle_suv_comparison: 'Yüksek bakış açısıyla iki seçenek netleşti.',
  vehicle_ev_comparison: 'Sessiz güç ve şarj ışığında yeni bir seçim vardı.',
  tech_coding_ai: 'Kod editörünün ışığında fikirler daha görünür oldu.',
  tech_product_building: 'MVP ve roadmap bugün daha somut bir çizgiye yaklaştı.',
  tech_startup_strategy: 'Platform vizyonu için sakin ve net bir çerçeve kuruldu.',
  topic_generic: 'Bugünün sohbeti sakin bir görsel iz bıraktı.',
};

const STORY_TOPIC_HEADLINE: Partial<Record<StoryTopicId, string>> = {
  travel: 'Keşif Günü',
  vehicle: 'Karar Anı',
  architecture: 'Taş ve Form',
  technology_ai: 'Fikir Masası',
  finance: 'Plan Çizgisi',
  health: 'İyi Oluş Ritmi',
  food_culture: 'Mutfak İzleri',
  family: 'Yakınlık Alanı',
  education: 'Öğrenme Eşiği',
  spiritual_reflection: 'Sakin Yansıma',
  general_curiosity: 'Günün Aynası',
};

const STORY_TOPIC_QUOTE: Partial<Record<StoryTopicId, string>> = {
  travel: 'Ufuk ve rota bugün sohbetin merkezindeydi.',
  vehicle: 'İki seçenek arasında ölçülü bir netlik arandı.',
  architecture: 'Yapı, malzeme ve form üzerine dikkatli bir bakış vardı.',
  technology_ai: 'Ürün ve fikirler bugün daha görünür bir çizgiye yaklaştı.',
  general_curiosity: 'Bugünün sohbeti sakin bir görsel iz bıraktı.',
};

export type AlignMasterPosterTextInput = {
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

export function sanitizePosterFragment(text: string, maxLen: number): string {
  let t = collapseWhitespace(text);
  t = t.replace(PHONE_PATTERN, '');
  t = t.replace(EMAIL_PATTERN, '');
  for (const pat of RAW_CHAT_PATTERNS) {
    if (pat.test(t)) return '';
  }
  if (t.length > maxLen) {
    const slice = t.slice(0, maxLen);
    const lastSpace = slice.lastIndexOf(' ');
    t = lastSpace > 8 ? slice.slice(0, lastSpace) : slice;
  }
  return collapseWhitespace(t);
}

function pickNarrativeHeadline(input: AlignMasterPosterTextInput): string {
  for (const c of [input.dailyJourney, input.headline, input.dailyThemeTitle, input.mirrorMoment]) {
    const safe = sanitizePosterFragment(c ?? '', MASTER_POSTER_HEADLINE_MAX);
    if (safe.length >= 4) return safe;
  }
  return SUBTOPIC_ALIGNED_HEADLINE.topic_generic;
}

function pickNarrativeQuote(input: AlignMasterPosterTextInput): string {
  for (const c of [input.quote, input.themeDescription, input.tomorrowHint, input.mirrorMoment]) {
    const safe = sanitizePosterFragment(c ?? '', MASTER_POSTER_QUOTE_MAX);
    if (safe.length >= 8) return safe;
  }
  return SUBTOPIC_ALIGNED_QUOTE.topic_generic;
}

function resolveStoryTopicHeadline(topic: StoryTopicId): string {
  return STORY_TOPIC_HEADLINE[topic] ?? SUBTOPIC_ALIGNED_HEADLINE.topic_generic;
}

function resolveStoryTopicQuote(topic: StoryTopicId): string {
  return STORY_TOPIC_QUOTE[topic] ?? SUBTOPIC_ALIGNED_QUOTE.topic_generic;
}

export function alignMasterPosterText(input: AlignMasterPosterTextInput): MasterPosterText {
  const subtopicRes = input.sceneSubtopicResolution;
  const subtopic = subtopicRes?.primarySubtopic ?? 'topic_generic';
  const confidence = subtopicRes?.confidence ?? 0;
  const storyTopic = input.storyTopicResolution?.primaryTopic ?? 'general_curiosity';

  if (confidence > SUBTOPIC_HEADLINE_CONFIDENCE_MIN && subtopic !== 'topic_generic') {
    return {
      headline: sanitizePosterFragment(
        SUBTOPIC_ALIGNED_HEADLINE[subtopic],
        MASTER_POSTER_HEADLINE_MAX
      ),
      quote: sanitizePosterFragment(
        SUBTOPIC_ALIGNED_QUOTE[subtopic],
        MASTER_POSTER_QUOTE_MAX
      ),
    };
  }

  if (storyTopic !== 'general_curiosity' && confidence >= 0.35) {
    return {
      headline: sanitizePosterFragment(
        resolveStoryTopicHeadline(storyTopic),
        MASTER_POSTER_HEADLINE_MAX
      ),
      quote: sanitizePosterFragment(resolveStoryTopicQuote(storyTopic), MASTER_POSTER_QUOTE_MAX),
    };
  }

  return {
    headline: pickNarrativeHeadline(input),
    quote: pickNarrativeQuote(input),
  };
}
