/**
 * V3.3 — Concrete visual traces from the active conversation only.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { canonicalizeCoverageTokens } from '@/lib/eza/mirror/coverage/coverageSynonyms';
import {
  matchTurnToClusters,
  type ConversationTopicCluster,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicClusters';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type ConversationEvidenceRole = 'primary' | 'secondary' | 'ambient';
export type ConversationEvidenceSource = 'active_conversation';

export type ConversationEvidence = {
  label: string;
  visualHint: string;
  importance: number;
  source: ConversationEvidenceSource;
  role: ConversationEvidenceRole;
};

type EvidenceSeed = Omit<ConversationEvidence, 'source' | 'role'>;

const RECENCY_WINDOW = 3;
const RECENCY_BOOST = 1.35;
const MIN_EVIDENCE = 3;
const MAX_EVIDENCE = 6;

const TOKEN_EVIDENCE: Record<string, EvidenceSeed> = {
  japonya: {
    label: 'Japonya seyahati',
    visualHint: 'quiet travel atmosphere, subtle Japanese street rhythm, evening light',
    importance: 82,
  },
  tokyo: {
    label: 'Tokyo ritmi',
    visualHint: 'dynamic city glow, layered urban depth, modern street energy at dusk',
    importance: 78,
  },
  kyoto: {
    label: 'Kyoto / Gion gece yürüyüşü',
    visualHint: 'narrow evening street, warm lanterns, quiet walking route',
    importance: 90,
  },
  rota: {
    label: 'Rota planı',
    visualHint: 'small notebook, map line, train ticket detail',
    importance: 62,
  },
  harita: {
    label: 'Harita ve rota',
    visualHint: 'folded map edge, route line, station detail, travel notebook',
    importance: 60,
  },
  keşif: {
    label: 'Yerel keşif',
    visualHint: 'local neighborhood alley, small shopfront, unhurried walking pace',
    importance: 68,
  },
  seyahat: {
    label: 'Seyahat planı',
    visualHint: 'travel notebook, soft departure light, personal itinerary detail',
    importance: 70,
  },
  özbekistan: {
    label: 'İpek Yolu izi',
    visualHint: 'timeworn stone lane, warm dust light, distant minaret silhouette',
    importance: 84,
  },
  semerkant: {
    label: 'Semerkant taş dokusu',
    visualHint: 'turquoise tile detail, sun-worn masonry, quiet plaza depth',
    importance: 86,
  },

  cephe: {
    label: 'Cephe kararı',
    visualHint: 'facade section study, stone and metal samples, proportion sketch',
    importance: 88,
  },
  malzeme: {
    label: 'Malzeme seçimi',
    visualHint: 'stone, metal and wood material samples, tactile close-up',
    importance: 84,
  },
  mimari: {
    label: 'Mimari oran',
    visualHint: 'building section model, facade proportion sketch, soft dusk light',
    importance: 86,
  },
  restorasyon: {
    label: 'Restorasyon detayı',
    visualHint: 'heritage material repair, measured drawing, craft tools on desk',
    importance: 80,
  },
  villa: {
    label: 'Yapı formu',
    visualHint: 'architectural model, courtyard light, human-scale exterior detail',
    importance: 76,
  },

  ai: {
    label: 'Yapay zeka güveni',
    visualHint: 'person at quiet desk, screen reflection, thoughtful pause, dark room',
    importance: 86,
  },
  trust: {
    label: 'Güven endişesi',
    visualHint: 'human figure pausing before screen glow, ethical decision moment, quiet room',
    importance: 82,
  },
  ethics: {
    label: 'Etik yansıma',
    visualHint: 'handwritten notes, soft monitor light, human-scale moral pause',
    importance: 78,
  },
  technology: {
    label: 'Teknoloji etkisi',
    visualHint: 'screen glow on face, subtle connection lines, contemplative interior',
    importance: 76,
  },
  safety: {
    label: 'Güvenlik ve kontrol',
    visualHint: 'notes on desk, restrained screen light, human decision anchor',
    importance: 74,
  },
  reflection: {
    label: 'İç yansıma',
    visualHint: 'window light, solitary figure, quiet thinking posture',
    importance: 72,
  },
  eza: {
    label: 'İnsan–sistem ilişkisi',
    visualHint: 'human figure, subtle connection lines, screen glow, decision moment',
    importance: 78,
  },
  strateji: {
    label: 'Teknoloji kararı',
    visualHint: 'notes on desk, soft monitor light, human scale decision scene',
    importance: 72,
  },

  'diş macunu': {
    label: 'Diş macunu seçimi',
    visualHint: 'bathroom counter, toothbrush, two product tubes side by side, morning light',
    importance: 88,
  },
  florür: {
    label: 'Florür tercihi',
    visualHint: 'toothpaste tube detail, calm sink light, quiet comparison note',
    importance: 76,
  },
  'hassas diş': {
    label: 'Hassasiyet endişesi',
    visualHint: 'soft bathroom light, gentle care ritual, subtle sensitivity note',
    importance: 80,
  },
  beyazlatıcı: {
    label: 'Beyazlatıcı tercihi',
    visualHint: 'two toothpaste options, handwritten comparison, morning window light',
    importance: 74,
  },

  bmw: {
    label: 'BMW seçeneği',
    visualHint: 'premium sedan silhouette in dark garage, restrained side light',
    importance: 84,
  },
  mercedes: {
    label: 'Mercedes seçeneği',
    visualHint: 'second premium sedan silhouette, quiet comparison, night garage',
    importance: 84,
  },
  konfor: {
    label: 'Konfor önceliği',
    visualHint: 'car key on console, long-road notebook, comfort-focused interior hint',
    importance: 72,
  },
  'uzun yol': {
    label: 'Uzun yol ihtiyacı',
    visualHint: 'highway dusk light, route note, family-scale travel bag detail',
    importance: 70,
  },
  araba: {
    label: 'Araç kararı',
    visualHint: 'two car silhouettes, decision notes, quiet garage atmosphere',
    importance: 78,
  },

  manevi: {
    label: 'İç yön arayışı',
    visualHint: 'quiet interior, soft window light, solitary contemplation',
    importance: 80,
  },
  spiritual: {
    label: 'Manevi yansıma',
    visualHint: 'quiet interior, soft window light, solitary contemplation',
    importance: 80,
  },
  inner: {
    label: 'İç alan',
    visualHint: 'minimal room, inward posture, soft directional light',
    importance: 74,
  },
  silence: {
    label: 'Sessizlik',
    visualHint: 'empty negative space, still figure, calm window band',
    importance: 70,
  },
  soul: {
    label: 'Ruhsal yön',
    visualHint: 'quiet corner, warm shadow, contemplative pause',
    importance: 68,
  },
  faith: {
    label: 'İnanç ve sessizlik',
    visualHint: 'soft directional light, calm interior, inward posture',
    importance: 76,
  },
  prayer: {
    label: 'Sessiz dua anı',
    visualHint: 'window light band, still figure, minimal room detail',
    importance: 72,
  },
  building: {
    label: 'Yapı formu',
    visualHint: 'facade detail, material edge, human-scale architectural anchor',
    importance: 80,
  },
  design: {
    label: 'Tasarım kararı',
    visualHint: 'architect desk, sketch fragment, material sample, dusk lamp',
    importance: 78,
  },
  light: {
    label: 'Işık ve gölge',
    visualHint: 'soft light across surface, shadow line, measured composition',
    importance: 74,
  },
  structure: {
    label: 'Yapısal oran',
    visualHint: 'section model, proportion sketch, restrained exterior detail',
    importance: 72,
  },
  compare: {
    label: 'Karşılaştırma notu',
    visualHint: 'handwritten list, two options implied, quiet desk lamp',
    importance: 70,
  },
  decision: {
    label: 'Karar anı',
    visualHint: 'notebook, pen pause, soft practical light, human scale',
    importance: 68,
  },
  premium: {
    label: 'Premium tercih',
    visualHint: 'restrained luxury detail, polished surface, quiet comparison',
    importance: 66,
  },
  vehicle: {
    label: 'Araç seçimi',
    visualHint: 'garage silhouette, key detail, route note on console',
    importance: 70,
  },
  car: {
    label: 'Otomobil kararı',
    visualHint: 'two silhouettes implied, dark garage, decision notebook',
    importance: 68,
  },
  luxury: {
    label: 'Lüks konfor',
    visualHint: 'premium interior hint, soft leather light, long-road mood',
    importance: 66,
  },
  quality: {
    label: 'Kalite önceliği',
    visualHint: 'comparison note, tactile material detail, calm light',
    importance: 64,
  },
  showroom: {
    label: 'Seçim sahnesi',
    visualHint: 'quiet garage or showroom corner, side light, no brand hero',
    importance: 62,
  },
};

const CLUSTER_EVIDENCE: Record<string, EvidenceSeed[]> = {
  japan_travel: [
    {
      label: 'Kyoto / Gion gece yürüyüşü',
      visualHint: 'narrow evening street, warm lanterns, quiet walking route',
      importance: 92,
    },
    {
      label: 'Sakin kafeler',
      visualHint: 'small quiet cafe glow, tea cup, window seat',
      importance: 72,
    },
    {
      label: 'Rota planı',
      visualHint: 'small notebook, map line, train ticket detail',
      importance: 64,
    },
  ],
  vehicle_compare: [
    {
      label: 'İki premium sedan',
      visualHint: 'two restrained car silhouettes in a dark garage, side-by-side comparison',
      importance: 90,
    },
    {
      label: 'Uzun yol konforu',
      visualHint: 'route notebook, car keys, night highway glow through window',
      importance: 74,
    },
    {
      label: 'Karar notları',
      visualHint: 'handwritten comparison list, quiet decision desk, soft lamp',
      importance: 66,
    },
  ],
  facade_material: [
    {
      label: 'Cephe malzemesi',
      visualHint: 'stone and metal samples, facade section sketch, measured proportions',
      importance: 90,
    },
    {
      label: 'Işık ve gölge',
      visualHint: 'soft light across building section model, shadow line on material',
      importance: 78,
    },
    {
      label: 'Mimari eskiz',
      visualHint: 'architect desk, hand sketch, scale model fragment',
      importance: 70,
    },
  ],
  toothpaste_choice: [
    {
      label: 'Diş macunu karşılaştırması',
      visualHint: 'two toothpaste tubes on bathroom counter, morning light, quiet choice',
      importance: 88,
    },
    {
      label: 'Hassasiyet endişesi',
      visualHint: 'soft sink light, toothbrush, gentle care ritual',
      importance: 76,
    },
    {
      label: 'Güvenli seçim',
      visualHint: 'handwritten note between products, calm personal care moment',
      importance: 68,
    },
  ],
  sensitive_teeth: [
    {
      label: 'Hassas dişler',
      visualHint: 'soft bathroom morning light, gentle brushing ritual, calm tone',
      importance: 82,
    },
  ],
  whitening_toothpaste: [
    {
      label: 'Beyazlatıcı tercihi',
      visualHint: 'product comparison on counter, subtle note, no clinical scene',
      importance: 78,
    },
  ],
  fluoride_toothpaste: [
    {
      label: 'Florürlü seçenek',
      visualHint: 'toothpaste tube detail, sink-side note, quiet morning decision',
      importance: 76,
    },
  ],
  ai_trust: [
    {
      label: 'Yapay zeka güveni',
      visualHint: 'person at quiet desk, screen reflection, thoughtful pause, dark room',
      importance: 90,
    },
    {
      label: 'Etik yansıma',
      visualHint: 'notes on desk, soft monitor light, human decision moment',
      importance: 78,
    },
    {
      label: 'İnsan etkisi',
      visualHint: 'human figure in soft shadow, subtle connection lines, no robot',
      importance: 72,
    },
  ],
};

const TOPIC_FALLBACK_EVIDENCE: Record<StoryTopicId, EvidenceSeed[]> = {
  travel: [
    {
      label: 'Yolculuk ritmi',
      visualHint: 'personal travel notebook, route line, departure light, walking figure',
      importance: 68,
    },
    {
      label: 'Yerel atmosfer',
      visualHint: 'quiet street detail, small local shop glow, unhurried pace',
      importance: 62,
    },
  ],
  architecture: [
    {
      label: 'Malzeme ve oran',
      visualHint: 'material samples, facade sketch, soft architectural model light',
      importance: 70,
    },
    {
      label: 'Yapı detayı',
      visualHint: 'one strong exterior detail, human-scale proportion, dusk shadow',
      importance: 64,
    },
  ],
  technology_ai: [
    {
      label: 'İnsan yansıması',
      visualHint: 'person thinking at desk, screen glow, quiet room, ethical pause',
      importance: 72,
    },
    {
      label: 'Güven ve kontrol',
      visualHint: 'notes, subtle connection lines, human figure in soft shadow',
      importance: 66,
    },
    {
      label: 'Karar anı',
      visualHint: 'desk lamp, handwritten note, screen edge glow, human scale',
      importance: 62,
    },
  ],
  health: [
    {
      label: 'Kişisel bakım ritüeli',
      visualHint: 'morning bathroom light, toothbrush, quiet daily choice',
      importance: 70,
    },
    {
      label: 'Güvenli tercih',
      visualHint: 'two product options, handwritten note, calm counter surface',
      importance: 64,
    },
  ],
  vehicle: [
    {
      label: 'Araç karşılaştırması',
      visualHint: 'two silhouettes, garage light, decision notebook',
      importance: 72,
    },
    {
      label: 'Uzun yol konforu',
      visualHint: 'route map edge, car key, night highway reflection',
      importance: 64,
    },
  ],
  finance: [
    {
      label: 'Gelecek planı',
      visualHint: 'notebook, soft desk lamp, threshold light through window',
      importance: 66,
    },
  ],
  food_culture: [
    {
      label: 'Mutfak anısı',
      visualHint: 'recipe notebook, warm kitchen light, ingredient detail',
      importance: 66,
    },
  ],
  family: [
    {
      label: 'Yakınlık ritmi',
      visualHint: 'shared home light, quiet table detail, warm interior',
      importance: 64,
    },
  ],
  education: [
    {
      label: 'Öğrenme anı',
      visualHint: 'open notebook, desk lamp, page edge glow',
      importance: 64,
    },
  ],
  spiritual_reflection: [
    {
      label: 'Sessiz yön',
      visualHint: 'window light, solitary figure, calm negative space',
      importance: 66,
    },
    {
      label: 'İç alan',
      visualHint: 'minimal interior, soft directional light, contemplative posture',
      importance: 62,
    },
    {
      label: 'Sakin nefes',
      visualHint: 'quiet room corner, warm shadow, inward gaze',
      importance: 58,
    },
  ],
  general_curiosity: [
    {
      label: 'Merak izi',
      visualHint: 'notebook, soft light, one concrete object of inquiry',
      importance: 60,
    },
    {
      label: 'Soru anı',
      visualHint: 'desk detail, pen pause, directional lamp, human scale',
      importance: 56,
    },
    {
      label: 'Yön arayışı',
      visualHint: 'window light edge, quiet interior, single focal object',
      importance: 54,
    },
  ],
};

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function assignRoles(items: ConversationEvidence[]): ConversationEvidence[] {
  return items.map((item, index) => ({
    ...item,
    role: index === 0 ? 'primary' : index <= 2 ? 'secondary' : 'ambient',
  }));
}

function upsertEvidence(
  map: Map<string, ConversationEvidence>,
  seed: EvidenceSeed,
  weight: number
): void {
  const key = seed.label.toLowerCase();
  const importance = Math.round(seed.importance * weight);
  const prev = map.get(key);
  if (!prev || importance > prev.importance) {
    map.set(key, {
      label: seed.label,
      visualHint: seed.visualHint,
      importance,
      source: 'active_conversation',
      role: 'ambient',
    });
  }
}

function aggregateTokens(entries: SavedBehavioralEntry[]): Map<string, number> {
  const weights = new Map<string, number>();
  const recentStart = Math.max(0, entries.length - RECENCY_WINDOW);

  entries.forEach((entry, index) => {
    const recencyMultiplier =
      index >= recentStart ? RECENCY_BOOST : 1;
    const hints = canonicalizeCoverageTokens(entry.mirrorCueHints ?? []);
    for (const token of hints) {
      const key = normalizeToken(token);
      weights.set(key, (weights.get(key) ?? 0) + recencyMultiplier);
    }
  });

  return weights;
}

function addClusterEvidence(
  map: Map<string, ConversationEvidence>,
  cluster: ConversationTopicCluster,
  weight: number
): void {
  const seeds = CLUSTER_EVIDENCE[cluster.id] ?? [];
  for (const seed of seeds) {
    upsertEvidence(map, seed, weight);
  }
}

export type ResolveConversationEvidenceInput = {
  entries: SavedBehavioralEntry[];
  storyTopicId: StoryTopicId;
  selectedTopic: string;
  candidateTopics?: readonly { topic: string; weight?: number }[];
};

/**
 * Extract 3–6 concrete visual traces from the active conversation only.
 * Never invents topics outside cue hints and matched clusters.
 */
export function resolveConversationEvidence(
  input: ResolveConversationEvidenceInput
): ConversationEvidence[] {
  const map = new Map<string, ConversationEvidence>();
  const tokenWeights = aggregateTokens(input.entries);

  for (const [token, weight] of tokenWeights) {
    const seed = TOKEN_EVIDENCE[token];
    if (seed) {
      upsertEvidence(map, seed, weight);
    }
  }

  for (const [token, weight] of tokenWeights) {
    const clusters = matchTurnToClusters([token]);
    for (const cluster of clusters) {
      addClusterEvidence(map, cluster, weight);
    }
  }

  const selectedLower = input.selectedTopic.trim().toLowerCase();
  if (selectedLower) {
    for (const seeds of Object.values(CLUSTER_EVIDENCE)) {
      for (const seed of seeds) {
        if (
          seed.label.toLowerCase().includes(selectedLower) ||
          selectedLower.includes(seed.label.toLowerCase().slice(0, 8))
        ) {
          upsertEvidence(map, seed, 1.15);
        }
      }
    }
  }

  for (const candidate of input.candidateTopics ?? []) {
    const clusters = matchTurnToClusters([candidate.topic]);
    const candidateWeight = 0.85 + Math.min(0.4, (candidate.weight ?? 0) / 20);
    for (const cluster of clusters) {
      addClusterEvidence(map, cluster, candidateWeight);
    }
  }

  const fallbacks = TOPIC_FALLBACK_EVIDENCE[input.storyTopicId] ?? TOPIC_FALLBACK_EVIDENCE.general_curiosity;
  for (const seed of fallbacks) {
    if (map.size >= MIN_EVIDENCE) break;
    upsertEvidence(map, seed, 0.75);
  }

  const sorted = [...map.values()]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, MAX_EVIDENCE);

  while (sorted.length < MIN_EVIDENCE) {
    const extra = fallbacks[sorted.length];
    if (!extra) break;
    if (!sorted.some((item) => item.label.toLowerCase() === extra.label.toLowerCase())) {
      sorted.push({
        ...extra,
        source: 'active_conversation',
        role: 'ambient',
      });
    } else {
      break;
    }
  }

  return assignRoles(sorted);
}

export function formatConversationEvidenceBlock(
  evidence: readonly ConversationEvidence[]
): string {
  if (!evidence.length) {
    return 'Conversation evidence:\nNo explicit cues — use selected topic with one strong cinematic anchor only.';
  }

  const lines = evidence.map(
    (item) =>
      `- ${item.label} (${item.role}) → ${item.visualHint}`
  );

  return [
    'Conversation evidence:',
    'Use these concrete traces from the active conversation as visible scene details.',
    'They must be recognizable enough for viewers to infer what the user talked about.',
    'Do not turn them into a checklist.',
    'Do not write them as bullet points in the poster.',
    'Integrate them naturally into the cinematic scene.',
    ...lines,
    '',
    'Evidence weight:',
    'Conversation evidence: 60% of scene design.',
    'Meaning and emotion: 25% mood shaping.',
    'Art direction finish: 15%.',
    'The final poster should visually communicate the conversation topic within 3 seconds.',
    'Use evidence as the primary scene design driver; mood must not erase the topic.',
  ].join('\n');
}
