/**
 * V4.3 — topic-aware shot director.
 * Shot mode is chosen from conversation topic, not random seed rotation.
 */

import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type TopicShotMode =
  | 'documentary_wide'
  | 'architectural_editorial'
  | 'cinematic_garage'
  | 'research_editorial'
  | 'lifestyle_editorial'
  | 'contemplative_editorial'
  | 'macro_material'
  | 'editorial_medium';

export const TOPIC_SHOT_DESCRIPTIONS: Record<TopicShotMode, string> = {
  documentary_wide:
    '35mm documentary wide — environmental storytelling, street-level context, human scale',
  architectural_editorial:
    'architectural editorial — facade lines, proportion, material truth, magazine cover discipline',
  cinematic_garage:
    'cinematic garage — vehicle silhouettes, comparison environment, controlled side light',
  research_editorial:
    'research editorial — desk, notebooks, diagrams, screens, visible thinking artifacts',
  lifestyle_editorial:
    'lifestyle editorial — personal ritual space, calm morning light, quiet daily choice',
  contemplative_editorial:
    'contemplative editorial — courtyard architecture, calligraphy detail, quiet sacred space',
  macro_material:
    'macro material study — stone, metal, texture, craft surfaces, tactile product detail',
  editorial_medium:
    '50mm editorial medium — controlled subject placement, premium magazine frame',
};

const DEFAULT_SHOT_BY_TOPIC: Record<StoryTopicId, TopicShotMode> = {
  travel: 'documentary_wide',
  architecture: 'architectural_editorial',
  vehicle: 'cinematic_garage',
  technology_ai: 'research_editorial',
  health: 'lifestyle_editorial',
  spiritual_reflection: 'contemplative_editorial',
  finance: 'editorial_medium',
  food_culture: 'lifestyle_editorial',
  family: 'editorial_medium',
  education: 'research_editorial',
  general_curiosity: 'editorial_medium',
};

export function inferStoryTopicFromEvidence(
  storyTopicId: StoryTopicId,
  evidence: readonly ConversationEvidence[],
  selectedTopic: string
): StoryTopicId {
  if (storyTopicId !== 'general_curiosity') return storyTopicId;

  const blob = [
    selectedTopic,
    ...evidence.map((item) => `${item.label} ${item.visualHint}`),
  ]
    .join(' ')
    .toLowerCase();

  if (/car|garage|bmw|mercedes|vehicle|sedan|araba|otomobil/.test(blob)) return 'vehicle';
  if (/kyoto|japan|japonya|travel|gion|lantern|seyahat/.test(blob)) return 'travel';
  if (/uzbek|özbek|samarkand|semerkant|buhara/.test(blob)) return 'travel';
  if (/shopping|product|ürün|urun|purchase|mvp|startup/.test(blob)) return storyTopicId;
  if (/route|rota|ticket|notebook|map/.test(blob) && !/garage|sedan|car|bmw|mercedes/.test(blob)) {
    return 'travel';
  }
  if (/facade|cephe|mimari|architecture|material|sketch|building/.test(blob)) {
    return 'architecture';
  }
  if (/courtyard|spiritual|prayer|calligraphy|mosque|manevi|din|faith|soul|dua|inanç|ruhsal|sessiz dua/.test(blob)) {
    return 'spiritual_reflection';
  }
  if (/yapay zeka|yapay|technology|openai|screen|desk|diagram|research|\bai\b/.test(blob)) {
    return 'technology_ai';
  }
  if (/thyroid|guatr|tiroid|boyun/.test(blob)) return 'health';
  if (/toothpaste|bathroom|brush|sink|diş|florür|bakım/.test(blob)) return 'health';
  return storyTopicId;
}

function evidenceBlob(evidence: readonly ConversationEvidence[]): string {
  return evidence.map((item) => `${item.label} ${item.visualHint}`).join(' ').toLowerCase();
}

/** macro_material only for architecture, materials, craftsmanship, product-detail topics. */
export function isMacroMaterialEligible(
  topicId: StoryTopicId,
  evidence: readonly ConversationEvidence[]
): boolean {
  if (topicId === 'travel' || topicId === 'vehicle' || topicId === 'health') return false;
  if (topicId === 'technology_ai' || topicId === 'spiritual_reflection') return false;
  if (topicId === 'architecture') return true;

  if (topicId !== 'general_curiosity') return false;

  const blob = evidenceBlob(evidence);
  return /material|malzeme|craft|craftsmanship|product.detail|texture|doku|numune|sample|detay|wood|taş|stone|metal/.test(
    blob
  );
}

function shouldUseMacroMaterial(
  topicId: StoryTopicId,
  evidence: readonly ConversationEvidence[]
): boolean {
  if (!isMacroMaterialEligible(topicId, evidence)) return false;

  const primary = evidence.find((item) => item.role === 'primary') ?? evidence[0];
  if (!primary) return topicId === 'architecture';

  const blob = `${primary.label} ${primary.visualHint}`.toLowerCase();
  return /material|malzeme|sample|numune|texture|doku|craft|product|cephe|stone|metal|facade|detay|taş|wood|sketch/.test(
    blob
  );
}

export function resolveTopicShotMode(input: {
  storyTopicId: StoryTopicId;
  evidence: readonly ConversationEvidence[];
  selectedTopic: string;
}): { mode: TopicShotMode; description: string; source: 'topic-aware' } {
  const topicId = inferStoryTopicFromEvidence(
    input.storyTopicId,
    input.evidence,
    input.selectedTopic
  );

  let mode: TopicShotMode = DEFAULT_SHOT_BY_TOPIC[topicId] ?? 'editorial_medium';

  if (shouldUseMacroMaterial(topicId, input.evidence)) {
    mode = 'macro_material';
  }

  if (mode === 'macro_material' && !isMacroMaterialEligible(topicId, input.evidence)) {
    mode = DEFAULT_SHOT_BY_TOPIC[topicId] ?? 'editorial_medium';
  }

  return {
    mode,
    description: TOPIC_SHOT_DESCRIPTIONS[mode],
    source: 'topic-aware',
  };
}
