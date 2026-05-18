/**
 * Standalone share — clipboard text + preview payloads (no image export).
 */

import type { DailyObservationView } from '@/lib/eza/dailyObservation';
import { MIRROR_LABELS } from '@/lib/eza/presentationTone';
import type { StandalonePersonaView } from '@/lib/eza/standalonePersonas';
import type { RelationshipMapViewModel } from '@/lib/eza/relationshipMapModel';

const WATERMARK = 'eza.global';

export interface ObservationSharePayload {
  title: string;
  personaLabel: string;
  insight: string;
  userLine: string;
  aiLine: string;
  balanceLine: string;
  clipboardText: string;
}

export interface RelationshipMapSharePayload {
  title: string;
  periodLabel: string;
  editorialNote: string;
  topIslands: { label: string; description: string }[];
  clipboardText: string;
}

export function buildObservationSharePayload(
  observation: DailyObservationView,
  persona: StandalonePersonaView
): ObservationSharePayload {
  const mirror = MIRROR_LABELS.standalone;
  const insight =
    observation.primaryInsight ||
    observation.manset ||
    'Son konuşmalarından kısa bir etkileşim notu.';

  const clipboardText = [
    'EZA — AI ile son etkileşim gözlemim',
    '',
    persona.name,
    insight,
    '',
    `${mirror.user}: ${observation.userLine}`,
    `${mirror.ai}: ${observation.aiLine}`,
    `${mirror.balance}: ${observation.balanceLine}`,
    '',
    WATERMARK,
  ].join('\n');

  return {
    title: 'AI ile son etkileşim gözlemim',
    personaLabel: persona.name,
    insight,
    userLine: observation.userLine,
    aiLine: observation.aiLine,
    balanceLine: observation.balanceLine,
    clipboardText,
  };
}

export function buildRelationshipMapSharePayload(
  model: RelationshipMapViewModel
): RelationshipMapSharePayload {
  const periodLabel = `Son ${model.periodDays} gün`;
  const topIslands = model.islands.slice(0, 3).map((i) => ({
    label: i.label,
    description: i.description,
  }));

  const islandLines =
    topIslands.length > 0
      ? topIslands.map((i) => `· ${i.label}: ${i.description}`).join('\n')
      : '· Henüz belirgin bir ada oluşmadı.';

  const clipboardText = [
    'EZA — İlişki haritamdan kısa bir not',
    '',
    periodLabel,
    '',
    model.editorialNote || model.shortNote,
    '',
    'Davranış adaları:',
    islandLines,
    '',
    WATERMARK,
  ].join('\n');

  return {
    title: 'EZA ilişki haritamdan kısa bir not',
    periodLabel,
    editorialNote: model.editorialNote || model.shortNote,
    topIslands,
    clipboardText,
  };
}

export async function copyShareText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShareIfAvailable(
  title: string,
  text: string
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}
