/**
 * Deterministic Semantic Anchors extractor.
 * No LLM — D2 interpretation + D1 user_stated evidence only.
 */

import { djb2Hex } from '@/lib/eza/mirror/mirrorLineageHash';
import type {
  BuildSemanticAnchorsInput,
  MirrorSemanticAnchorsV1,
  SemanticAnchorEvidenceItem,
} from '@/lib/eza/mirror/semanticAnchors/types';
import { MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION } from '@/lib/eza/mirror/semanticAnchors/types';

const MAX_SCENE = 8;
const MAX_EMOTION = 6;
const MAX_CRITERIA = 5;
const MAX_TOKEN = 64;

const PLACE_HINTS =
  /\b(mardin|istanbul|ankara|izmir|kapadokya|cappadocia|tokyo|kyoto|paris|rome|roma|venice|lisbon|marrakech|cairo)\b/i;

const VEHICLE_PAIR =
  /\b(bmw\s*x3|mercedes(?:-|\s)?benz?\s*glc|mercedes\s*glc|x3|glc)\b/gi;

const CRITERIA_LEXICON = [
  'sessizlik',
  'konfor',
  'güvenlik',
  'uzun yol',
  'aile',
  'yakıt',
  'huzur',
  'silence',
  'comfort',
  'safety',
  'long trip',
  'family',
  'quiet',
] as const;

const EMOTION_LEXICON = [
  'quiet',
  'slow',
  'local',
  'calm',
  'warm',
  'soft',
  'intimate',
  'peaceful',
  'hushed',
  'sessiz',
  'sakin',
  'yerel',
  'sıcak',
  'yumuşak',
  'huzurlu',
] as const;

const SCENE_STOP =
  /^(the|a|an|and|with|from|into|over|under|this|that|bir|ve|ile|için|bu|şu|o|çok|daha)$/i;

function cleanToken(raw: string): string {
  return raw
    .replace(/[“”"'`]/g, '')
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TOKEN);
}

function uniqPush(list: string[], value: string, max: number): void {
  const v = cleanToken(value);
  if (!v || v.length < 2) return;
  const key = v.toLowerCase();
  if (list.some((x) => x.toLowerCase() === key)) return;
  if (list.length >= max) return;
  list.push(v);
}

function userStatedEvidence(
  evidence: ReadonlyArray<SemanticAnchorEvidenceItem> | null | undefined
): SemanticAnchorEvidenceItem[] {
  if (!evidence?.length) return [];
  return evidence.filter((row) => {
    const epi = (row.epistemic || '').toLowerCase();
    return !epi || epi === 'user_stated' || epi === 'user_preference' || epi === 'accepted_decision';
  });
}

function extractPlace(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[]
): string | null {
  for (const row of stated) {
    const text = cleanToken(row.text || '');
    if (!text) continue;
    const kind = (row.kind || '').toLowerCase();
    if (kind === 'entity' && text.length <= 40 && !/\s{3,}/.test(text)) {
      if (/^[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü'-]{1,40}$/.test(text) || PLACE_HINTS.test(text)) {
        return text;
      }
    }
    const placeHit = text.match(PLACE_HINTS);
    if (placeHit?.[1]) {
      return placeHit[1].replace(/^\w/, (c) => c.toUpperCase());
    }
  }

  const blob = [
    interpretation.title,
    interpretation.interpretationSummary,
    interpretation.visualNarrative,
  ]
    .filter(Boolean)
    .join(' ');
  const fromInterp = blob.match(PLACE_HINTS);
  if (fromInterp?.[1]) {
    return fromInterp[1].replace(/^\w/, (c) => c.toUpperCase());
  }
  return null;
}

function extractSceneProps(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[]
): string[] {
  const scene: string[] = [];

  for (const row of stated) {
    const text = cleanToken(row.text || '');
    if (!text) continue;
    const kind = (row.kind || '').toLowerCase();
    if (kind === 'entity' || kind === 'preference' || kind === 'other' || !kind) {
      if (text.split(/\s+/).length <= 5 && !SCENE_STOP.test(text)) {
        uniqPush(scene, text, MAX_SCENE);
      }
    }
  }

  const narrative = cleanToken(interpretation.visualNarrative || '');
  if (narrative) {
    const evidenceKeys = stated.map((s) => cleanToken(s.text || '').toLowerCase()).filter(Boolean);
    for (const key of evidenceKeys) {
      if (key.length < 3) continue;
      if (
        narrative.toLowerCase().includes(key) ||
        key.split(/\s+/).some((p) => narrative.toLowerCase().includes(p))
      ) {
        uniqPush(scene, key, MAX_SCENE);
      }
    }
  }

  return scene.slice(0, MAX_SCENE);
}

function extractEmotion(
  interpretation: BuildSemanticAnchorsInput['interpretation']
): string[] {
  const emotion: string[] = [];
  const blob = [
    interpretation.atmosphereHint,
    interpretation.imageIntent,
    interpretation.interpretationSummary,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const word of EMOTION_LEXICON) {
    if (blob.includes(word)) {
      uniqPush(emotion, word, MAX_EMOTION);
    }
  }

  const hint = cleanToken(interpretation.atmosphereHint || '');
  if (hint) {
    for (const part of hint.split(/[/,|]+/)) {
      uniqPush(emotion, part, MAX_EMOTION);
    }
  }

  return emotion.slice(0, MAX_EMOTION);
}

function extractTopic(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[]
): string | null {
  const blob = [
    ...stated.map((s) => s.text),
    interpretation.title,
    interpretation.interpretationSummary,
  ]
    .filter(Boolean)
    .join(' ');

  const vehicles = Array.from(blob.matchAll(VEHICLE_PAIR)).map((m) =>
    m[0].replace(/\s+/g, ' ').trim()
  );
  const normalized = vehicles.map((v) => v.toLowerCase());
  const hasX3 = normalized.some((v) => /x3|bmw/.test(v));
  const hasGlc = normalized.some((v) => /glc|mercedes/.test(v));
  if (hasX3 && hasGlc) return 'BMW X3 vs Mercedes GLC';

  if (PLACE_HINTS.test(blob) && /çay|sandalye|sokak|mahalle|evening|akşam/i.test(blob)) {
    const place = blob.match(PLACE_HINTS)?.[1];
    if (place) return `${place[0].toUpperCase()}${place.slice(1)} evening`;
  }

  const title = cleanToken(interpretation.title || '');
  if (title && title.split(/\s+/).length <= 8) return title;
  return null;
}

function extractUserIntent(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[]
): string | null {
  for (const row of stated) {
    const kind = (row.kind || '').toLowerCase();
    const text = cleanToken(row.text || '');
    if (!text) continue;
    if (kind === 'preference' || kind === 'decision' || kind === 'question') {
      return text.slice(0, 80);
    }
    if (/aile|family|seç|choose|karar|decision|vs|mü|mi\b/i.test(text)) {
      return text.slice(0, 80);
    }
  }
  const summary = cleanToken(interpretation.interpretationSummary || '');
  return summary ? summary.slice(0, 80) : null;
}

function extractDecisionCriteria(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[]
): string[] {
  const criteria: string[] = [];
  const blob = [
    ...stated.map((s) => s.text),
    interpretation.interpretationSummary,
    interpretation.imageIntent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const word of CRITERIA_LEXICON) {
    if (blob.includes(word)) {
      uniqPush(criteria, word, MAX_CRITERIA);
    }
  }
  return criteria.slice(0, MAX_CRITERIA);
}

function extractQuestion(
  interpretation: BuildSemanticAnchorsInput['interpretation'],
  stated: SemanticAnchorEvidenceItem[],
  topic: string | null
): string | null {
  for (const row of stated) {
    const text = cleanToken(row.text || '');
    if (text.includes('?') || text.includes('？')) return text.slice(0, 90);
    if ((row.kind || '').toLowerCase() === 'question') return text.slice(0, 90);
  }
  if (topic && /vs|mü|mi\b/i.test(topic)) {
    return topic.includes('?') ? topic : `${topic}?`;
  }
  const title = cleanToken(interpretation.title || '');
  if (title.includes('?')) return title;
  return null;
}

function hashAnchors(anchors: Omit<MirrorSemanticAnchorsV1, 'anchorsHash' | 'contractVersion' | 'evidenceCount'>): string {
  const payload = JSON.stringify({
    place: anchors.place?.toLowerCase() ?? null,
    scene: anchors.scene.map((s) => s.toLowerCase()),
    emotion: anchors.emotion.map((e) => e.toLowerCase()),
    topic: anchors.topic?.toLowerCase() ?? null,
    userIntent: anchors.userIntent?.toLowerCase() ?? null,
    decisionCriteria: anchors.decisionCriteria.map((c) => c.toLowerCase()),
    question: anchors.question?.toLowerCase() ?? null,
  });
  return djb2Hex(payload);
}

export function buildSemanticAnchors(
  input: BuildSemanticAnchorsInput
): MirrorSemanticAnchorsV1 {
  const stated = userStatedEvidence(input.evidence);
  const place = extractPlace(input.interpretation, stated);
  const scene = extractSceneProps(input.interpretation, stated);
  const emotion = extractEmotion(input.interpretation);
  const topic = extractTopic(input.interpretation, stated);
  const userIntent = extractUserIntent(input.interpretation, stated);
  const decisionCriteria = extractDecisionCriteria(input.interpretation, stated);
  const question = extractQuestion(input.interpretation, stated, topic);

  const core = {
    place,
    scene,
    emotion,
    topic,
    userIntent,
    decisionCriteria,
    question,
  };

  return {
    contractVersion: MIRROR_SEMANTIC_ANCHORS_CONTRACT_VERSION,
    ...core,
    anchorsHash: hashAnchors(core),
    evidenceCount: stated.length,
  };
}

export function semanticAnchorsAreGrounded(anchors: MirrorSemanticAnchorsV1): boolean {
  return (
    Boolean(anchors.place) ||
    Boolean(anchors.topic) ||
    Boolean(anchors.question) ||
    anchors.scene.length >= 2 ||
    anchors.decisionCriteria.length >= 2
  );
}
