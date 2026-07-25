/**
 * Phase 0 — D2 Interpretation → publish/share curiosity meaning.
 * Never uses V3 story-topic heuristics (no Mardin→architecture default).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type {
  MirrorCuriosityBundle,
  MirrorSeed,
  MirrorTopicMood,
} from '@/lib/eza/mirror-network/types';
import type { ShareVoiceLine } from '@/lib/eza/mirror-share/types';
import { interpretationHashSync } from '@/lib/eza/mirror/mirrorLineageHash';

const MAX_HOOKS = 3;
const MAX_SEED_QUESTIONS = 3;
const MAX_SUBTOPICS = 4;

const KNOWN_TOPICS = new Set<StoryTopicId>([
  'vehicle',
  'travel',
  'architecture',
  'technology_ai',
  'finance',
  'health',
  'food_culture',
  'family',
  'education',
  'spiritual_reflection',
  'general_curiosity',
]);

function clean(text: string, max = 160): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function firstSentence(text: string, max = 120): string {
  const normalized = clean(text, 400);
  const match = normalized.match(/^(.+?[.!?…])(\s|$)/);
  return clean(match?.[1] ?? normalized, max);
}

export function mapInterpretationTopicToStoryTopicId(
  raw: string | null | undefined
): StoryTopicId {
  const t = (raw || '').toLowerCase().trim().replace(/\s+/g, '_');
  if (KNOWN_TOPICS.has(t as StoryTopicId)) return t as StoryTopicId;
  if (/travel|seyahat|trip|tourism|journey|city/.test(t)) return 'travel';
  if (/architect|mimari|heritage|stone|facade/.test(t)) return 'architecture';
  if (/health|wellness|sağlık/.test(t)) return 'health';
  if (/finance|para|money/.test(t)) return 'finance';
  if (/tech|ai|yapay/.test(t)) return 'technology_ai';
  if (/food|yemek|cuisine/.test(t)) return 'food_culture';
  if (/family|aile/.test(t)) return 'family';
  if (/educat|öğren|school/.test(t)) return 'education';
  if (/spirit|reflect|sessiz/.test(t)) return 'spiritual_reflection';
  if (/vehicle|araba|car|bmw|mercedes/.test(t)) return 'vehicle';
  return 'general_curiosity';
}

function moodForTopic(topic: StoryTopicId): MirrorTopicMood {
  if (topic === 'architecture') return 'analysis';
  if (topic === 'travel') return 'discovery';
  if (topic === 'health' || topic === 'finance') return 'planning';
  if (topic === 'vehicle') return 'comparison';
  if (topic === 'spiritual_reflection') return 'reflection';
  if (topic === 'technology_ai' || topic === 'education') return 'research';
  return 'discovery';
}

function subtopicsFromNarrative(narrative: string, atmosphere?: string | null): string[] {
  const blob = `${narrative} ${atmosphere ?? ''}`.toLowerCase();
  const cues: Array<[RegExp, string]> = [
    [/yellow stone|sarı taş|cobble|sokak/, 'Sarı taş sokak'],
    [/chair|sandalye/, 'Sandalye'],
    [/clothesline|çamaşır/, 'Çamaşır ipi'],
    [/minaret|mosque|cami|minare/, 'Minare'],
    [/lantern|fener|dusk|akşam/, 'Akşam ışığı'],
    [/tea|çay/, 'Çay molası'],
    [/rain|yağmur/, 'Yağmur'],
    [/narrow|dar/, 'Dar sokak'],
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [re, label] of cues) {
    if (!re.test(blob)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_SUBTOPICS) break;
  }
  return out;
}

function hooksFromInterpretation(
  interpretation: MirrorInterpretationV1,
  topic: StoryTopicId
): string[] {
  const hooks: string[] = [];
  const intent = clean(interpretation.imageIntent, 140);
  if (intent) hooks.push(intent.endsWith('?') ? intent : `${firstSentence(intent, 100)}`);

  const summary = firstSentence(interpretation.interpretationSummary, 110);
  if (summary && !hooks.some((h) => h.toLowerCase() === summary.toLowerCase())) {
    hooks.push(summary.endsWith('?') ? summary : `${summary.replace(/\.$/, '')}?`);
  }

  if (topic === 'travel') {
    hooks.push('Bir mahalle, turistik kartpostalardan önce nasıl hissedilir?');
  } else if (topic === 'architecture') {
    hooks.push('Bir mekânın dokusu hangi duyguyu taşır?');
  } else {
    hooks.push('Bu merak nereye açılıyor?');
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const h of hooks) {
    const key = h.toLowerCase();
    if (!h || seen.has(key)) continue;
    seen.add(key);
    unique.push(h);
    if (unique.length >= MAX_HOOKS) break;
  }
  return unique;
}

function seedQuestionsForTopic(topic: StoryTopicId): string[] {
  if (topic === 'travel') {
    return [
      'Bu şehri turistik olmayan bir rota ile nasıl keşfedersin?',
      'Sakin bir noktada oturup şehri izlemek için nereyi seçersin?',
    ];
  }
  if (topic === 'architecture') {
    return ['Bu mekânın malzemesi ve ışığı sana ne hissettiriyor?'];
  }
  return ['Bu konuyu kendi yolculuğun için nasıl keşfetmek istersin?'];
}

function shareVoiceForTopic(topic: StoryTopicId): ShareVoiceLine {
  if (topic === 'travel') {
    return { text: 'Yol bazen cevaptan önce gelir.', preset: 'quiet_editorial_minimal' };
  }
  if (topic === 'architecture') {
    return {
      text: 'Işık, bir yapının gerçek dilini bazen gece söyler.',
      preset: 'quiet_editorial_minimal',
    };
  }
  return {
    text: 'Bazı konular, yürürken daha iyi anlaşılır.',
    preset: 'quiet_editorial_minimal',
  };
}

function contextFromInterpretation(
  interpretation: MirrorInterpretationV1,
  topic: StoryTopicId,
  subtopics: string[]
): string {
  const summary = clean(interpretation.interpretationSummary, 220);
  if (summary) {
    // Public landing framing — creative summary, not chat replay.
    return `Bu merak alanı, ${summary.replace(/\.$/, '')} — sohbeti yeniden anlatmaz, keşfe kapı açar.`;
  }
  const theme = subtopics.length > 0 ? subtopics.slice(0, 2).join(', ') : topic.replace(/_/g, ' ');
  return `Bu merak alanı, ${theme} üzerine doğmuş bir keşif izinden ilham alır.`;
}

export type D2CuriosityBuildResult = {
  bundle: MirrorCuriosityBundle;
  semanticSource: 'd2_interpretation';
  interpretationHash: string;
};

/**
 * Canonical publish meaning from finalized D2 Interpretation.
 * Does not read V3 evidence, coverage cues, or architecture defaults.
 */
export function buildCuriosityFromInterpretation(
  interpretation: MirrorInterpretationV1
): D2CuriosityBuildResult {
  const topic = mapInterpretationTopicToStoryTopicId(interpretation.topicCategory);
  const mood = moodForTopic(topic);
  const subtopics = subtopicsFromNarrative(
    interpretation.visualNarrative,
    interpretation.atmosphereHint
  );
  const hooks = hooksFromInterpretation(interpretation, topic);
  const seedQuestions = seedQuestionsForTopic(topic).slice(0, MAX_SEED_QUESTIONS);
  const seed: MirrorSeed = {
    primaryTopic: clean(interpretation.title, 48) || topic,
    topicCategory: topic,
    mood,
    subtopics,
    curiosityHooks: hooks,
    seedQuestions,
    locale: 'tr',
  };
  const curiosityContext = {
    text: contextFromInterpretation(interpretation, topic, subtopics),
  };
  const coreCuriosity = hooks[0] || `${seed.primaryTopic} etrafında ne keşfedilmeyi bekliyor?`;
  const collectionTags = [topic.replace(/_/g, '-'), mood];
  const discoverySignals = [seed.primaryTopic, mood, ...subtopics.slice(0, 2)].filter(Boolean);

  const bundle: MirrorCuriosityBundle = {
    seed,
    cardTitle: clean(interpretation.title, 64),
    coreCuriosity,
    curiosityContext,
    hooks,
    landingContext: curiosityContext.text,
    seedQuestions,
    discoverySignals: discoverySignals.slice(0, 4),
    collectionTags: collectionTags.slice(0, 5),
    shareVoice: shareVoiceForTopic(topic),
    semanticSource: 'd2_interpretation',
  };

  return {
    bundle,
    semanticSource: 'd2_interpretation',
    // Sync fingerprint for card state; publish recomputes SHA-256 to match backend.
    interpretationHash: interpretationHashSync(interpretation),
  };
}
