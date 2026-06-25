/**
 * SAINA Mirror Philosophy — see ./philosophy.ts
 *
 * Curiosity Seed Intelligence pipeline (landing / discovery only).
 * V3 render brief feeds this layer; outputs never go on card or image prompt.
 *
 * Pipeline stages (extensible):
 *   Seed → Title → Core Curiosity → Context → Hooks → Landing → Seed Questions
 *   → Discovery Signals → Collection Tags
 */

import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type {
  MirrorCuriosityBundle,
  MirrorCuriosityContext,
  MirrorCuriosityPipeline,
  MirrorSeed,
  MirrorTopicMood,
} from '@/lib/eza/mirror-network/types';

const MAX_SUBTOPICS = 4;
const MAX_HOOKS = 3;
const MAX_SEED_QUESTIONS = 3;

function mapStoryTopicToMood(topicId: StoryTopicId, blob: string): MirrorTopicMood {
  if (topicId === 'vehicle' || /bmw|mercedes|karşılaştır|compare/.test(blob)) return 'comparison';
  if (topicId === 'spiritual_reflection') return 'reflection';
  if (topicId === 'architecture') return /material|cephe|facade|stone/.test(blob) ? 'analysis' : 'creative';
  if (topicId === 'technology_ai') return 'research';
  if (topicId === 'travel') return 'discovery';
  if (topicId === 'health') return 'planning';
  if (topicId === 'finance') return 'planning';
  if (topicId === 'education') return 'research';
  return 'discovery';
}

function sanitizeLabel(label: string): string {
  return label
    .replace(/\b(user|sen|ben|ömer|omer)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

function uniqueNonEmpty(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = sanitizeLabel(raw);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function evidenceBlob(evidence: readonly ConversationEvidence[]): string {
  return evidence.map((e) => `${e.label} ${e.visualHint}`).join(' ').toLowerCase();
}

function buildCuriosityHooks(topicId: StoryTopicId, subtopics: string[], blob: string): string[] {
  const hooks: string[] = [];
  if (topicId === 'travel') {
    if (/japan|japonya|kyoto/.test(blob)) {
      hooks.push('Kyoto’da bir akşam nasıl yaşanır?');
      hooks.push('Turistik olmayan bir rota nasıl hissedilir?');
    } else if (/uzbek|özbek|train|tren/.test(blob)) {
      hooks.push('Trenle geçen bir şehir nasıl okunur?');
      hooks.push('Yavaş seyahatte merak nerede derinleşir?');
    } else {
      hooks.push('Bir şehir haritadan önce yürüyerek nasıl hissedilir?');
    }
  } else if (topicId === 'architecture') {
    hooks.push('Taş ve ışık bir cephede nasıl konuşur?');
    hooks.push('Mimari bir karar hangi duyguyu taşır?');
  } else if (topicId === 'vehicle') {
    hooks.push('Uzun yolda hangi detaylar fark edilir?');
  } else if (topicId === 'technology_ai') {
    hooks.push('Teknolojiye güven nerede sınanır?');
  } else if (topicId === 'spiritual_reflection') {
    hooks.push('Sessizlik hangi soruyu açığa çıkarır?');
  } else {
    hooks.push('Bu merak nereye açılıyor?');
  }
  for (const s of subtopics.slice(0, 2)) {
    if (s.length > 6 && !hooks.some((h) => h.toLowerCase().includes(s.toLowerCase()))) {
      hooks.push(`${s} üzerine ne merak edilir?`);
    }
  }
  return uniqueNonEmpty(hooks, MAX_HOOKS);
}

function buildSeedQuestions(topicId: StoryTopicId, blob: string): string[] {
  if (topicId === 'travel' && /japan|japonya|kyoto/.test(blob)) {
    return [
      'Kyoto’da sadece bir akşamım olsa nasıl bir rota izlemeliyim?',
      'Japonya’da daha sakin ve yerel bir deneyim nasıl planlanır?',
    ];
  }
  if (topicId === 'travel' && /uzbek|özbek/.test(blob)) {
    return ['Özbekistan tren rotasında ilk durak nerede olmalı?'];
  }
  if (topicId === 'architecture') {
    return ['Bu malzeme ve ışık dili hangi mekâna daha çok yakışır?'];
  }
  if (topicId === 'vehicle') {
    return ['Uzun yolda konfor mu, karakter mi önce gelir?'];
  }
  return ['Bu konuyu kendi yolculuğun için nasıl keşfetmek istersin?'];
}

function buildCuriosityContextText(
  topicId: StoryTopicId,
  mood: MirrorTopicMood,
  subtopics: string[],
  blob: string
): string {
  const theme =
    subtopics.length > 0
      ? subtopics.slice(0, 3).join(', ')
      : topicId.replace(/_/g, ' ');

  if (topicId === 'travel' && /japan|japonya|kyoto/.test(blob)) {
    return `Bu merak alanı, Japonya’da yürüyerek keşif ve şehir atmosferi üzerine doğmuş bir sohbetten ilham alır — ${theme} etrafında açılır.`;
  }
  if (topicId === 'travel' && /uzbek|özbek|train|tren/.test(blob)) {
    return `Bu merak alanı, trenle geçen bir rota ve yavaş keşif hissinden doğmuş bir sohbetten ilham alır.`;
  }
  if (topicId === 'architecture') {
    return `Bu merak alanı, mimari malzeme, ışık ve cephe dili üzerine doğmuş bir araştırma izinden ilham alır.`;
  }
  if (topicId === 'vehicle') {
    return `Bu merak alanı, uzun yol ve araç karşılaştırması üzerine doğmuş bir merak izinden ilham alır.`;
  }
  if (topicId === 'technology_ai') {
    return `Bu merak alanı, yapay zekâ ve güven ilişkisi üzerine doğmuş bir sohbetten ilham alır.`;
  }
  if (topicId === 'health') {
    return `Bu merak alanı, sağlık ve beden farkındalığı üzerine doğmuş bir merak izinden ilham alır — bilgi değil, güvenli keşif dili.`;
  }

  const moodWord =
    mood === 'discovery'
      ? 'keşif'
      : mood === 'analysis'
        ? 'inceleme'
        : mood === 'planning'
          ? 'planlama'
          : 'merak';

  return `Bu merak alanı, ${theme} üzerine doğmuş bir ${moodWord} izinden ilham alır; sohbet özeti değil, güvenli bir giriş kapısıdır.`;
}

/** Stage: Seed — topic category, mood, subtopics, hooks (extensible). */
export function buildMirrorSeed(payload: SainaMirrorV3Payload): MirrorSeed {
  const brief = buildMirrorRenderBrief(payload);
  const blob = evidenceBlob(payload.conversationEvidence ?? []);
  const mood = mapStoryTopicToMood(brief.topicCategory, blob);
  const subtopics = uniqueNonEmpty(
    (payload.conversationEvidence ?? []).map((e) => e.label),
    MAX_SUBTOPICS
  );

  return {
    primaryTopic: sanitizeLabel(payload.selectedTopic || payload.topic) || brief.topicCategory,
    topicCategory: brief.topicCategory,
    mood,
    subtopics,
    curiosityHooks: buildCuriosityHooks(brief.topicCategory, subtopics, blob),
    seedQuestions: uniqueNonEmpty(
      buildSeedQuestions(brief.topicCategory, blob),
      MAX_SEED_QUESTIONS
    ),
    locale: 'tr',
  };
}

/** @deprecated Use buildMirrorSeed */
export const buildMirrorTopicDNA = buildMirrorSeed;

/** Stage: Title — cinematic card headline only. */
export function buildMirrorCardTitle(payload: SainaMirrorV3Payload): string {
  return payload.mirrorTitle;
}

/**
 * Stage: Core Curiosity — the wonder question behind the title (landing / discovery only).
 * Title ≠ Curiosity.
 */
export function buildMirrorCoreCuriosity(seed: MirrorSeed, blob: string): string {
  if (seed.topicCategory === 'travel' && /japan|japonya|kyoto|rain|yağmur/.test(blob)) {
    return 'Kyoto yağmurdan sonra nasıl bir atmosfer taşır?';
  }
  if (seed.topicCategory === 'travel' && /uzbek|özbek|train|tren/.test(blob)) {
    return 'Tren penceresinden bir şehir nasıl okunur?';
  }
  if (seed.curiosityHooks[0]) {
    return seed.curiosityHooks[0];
  }
  if (seed.seedQuestions[0]) {
    return seed.seedQuestions[0];
  }
  return `${seed.primaryTopic} etrafında ne keşfedilmeyi bekliyor?`;
}

/** Stage: Curiosity Context — safe landing framing (not chat summary). */
export function buildMirrorCuriosityContext(
  payload: SainaMirrorV3Payload,
  seed: MirrorSeed
): MirrorCuriosityContext {
  const blob = evidenceBlob(payload.conversationEvidence ?? []);
  return {
    text: buildCuriosityContextText(seed.topicCategory, seed.mood, seed.subtopics, blob),
  };
}

function buildDiscoverySignals(seed: MirrorSeed): string[] {
  return uniqueNonEmpty(
    [seed.primaryTopic, seed.mood, ...seed.subtopics.slice(0, 2)],
    4
  );
}

function buildCollectionTags(seed: MirrorSeed): string[] {
  const tags = [seed.topicCategory.replace(/_/g, '-'), seed.mood];
  return uniqueNonEmpty(tags, 5);
}

/** Full layered pipeline — prefer this over ad-hoc bundle assembly. */
export function buildMirrorCuriosityPipeline(
  payload: SainaMirrorV3Payload
): MirrorCuriosityPipeline {
  const blob = evidenceBlob(payload.conversationEvidence ?? []);
  const seed = buildMirrorSeed(payload);
  const cardTitle = buildMirrorCardTitle(payload);
  const coreCuriosity = buildMirrorCoreCuriosity(seed, blob);
  const curiosityContext = buildMirrorCuriosityContext(payload, seed);
  const hooks = seed.curiosityHooks;
  const seedQuestions = seed.seedQuestions;

  return {
    seed,
    cardTitle,
    coreCuriosity,
    curiosityContext,
    hooks,
    landingContext: curiosityContext.text,
    seedQuestions,
    discoverySignals: buildDiscoverySignals(seed),
    collectionTags: buildCollectionTags(seed),
  };
}

export function buildMirrorCuriosityBundle(payload: SainaMirrorV3Payload): MirrorCuriosityBundle {
  return buildMirrorCuriosityPipeline(payload);
}
