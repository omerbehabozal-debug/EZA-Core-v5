/**
 * P4-C5 — Style Lens session + Plus rotation (client-side; narrative unchanged).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  DEFAULT_STYLE_LENS_ID,
  getNextStyleLensId,
  getStyleLens,
  STYLE_LENS_PLUS_CYCLE,
  type StyleLensId,
} from '@/lib/eza/mirror/styleLensRegistry';

export const MIRROR_STYLE_LENS_STORAGE_KEY = 'eza_mirror_style_lens_v1';

export type MirrorStyleLensSession = {
  dayKey: string;
  cardDate: string;
  intentFingerprint: string;
  selectedStyleLensId: StyleLensId;
  sceneVariationIndex: number;
};

function dayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function isStyleLensId(value: unknown): value is StyleLensId {
  return (
    typeof value === 'string' &&
    (STYLE_LENS_PLUS_CYCLE as readonly string[]).includes(value)
  );
}

function normalizeSession(parsed: unknown): MirrorStyleLensSession | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (
    typeof raw.dayKey === 'string' &&
    typeof raw.cardDate === 'string' &&
    typeof raw.intentFingerprint === 'string' &&
    isStyleLensId(raw.selectedStyleLensId) &&
    typeof raw.sceneVariationIndex === 'number'
  ) {
    return {
      dayKey: raw.dayKey,
      cardDate: raw.cardDate,
      intentFingerprint: raw.intentFingerprint,
      selectedStyleLensId: raw.selectedStyleLensId,
      sceneVariationIndex: Math.max(0, Math.floor(raw.sceneVariationIndex)),
    };
  }
  return null;
}

export function readStyleLensSession(): MirrorStyleLensSession | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(MIRROR_STYLE_LENS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStyleLensSession(session: MirrorStyleLensSession): void {
  storage()?.setItem(MIRROR_STYLE_LENS_STORAGE_KEY, JSON.stringify(session));
}

export function clearStyleLensSession(): void {
  storage()?.removeItem(MIRROR_STYLE_LENS_STORAGE_KEY);
}

export function createDefaultStyleLensSession(
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'>,
  now: Date = new Date()
): MirrorStyleLensSession {
  return {
    dayKey: dayKeyFromDate(now),
    cardDate: card.date?.slice(0, 10) ?? dayKeyFromDate(now),
    intentFingerprint: card.visual?.intentFingerprint ?? '',
    selectedStyleLensId: DEFAULT_STYLE_LENS_ID,
    sceneVariationIndex: 0,
  };
}

export function sessionMatchesCard(
  session: MirrorStyleLensSession,
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'>,
  now: Date = new Date()
): boolean {
  const dayKey = dayKeyFromDate(now);
  const cardDate = card.date?.slice(0, 10) ?? '';
  const fingerprint = card.visual?.intentFingerprint ?? '';
  return (
    session.dayKey === dayKey &&
    session.cardDate === cardDate &&
    session.intentFingerprint === fingerprint
  );
}

export function resolveStyleLensSessionForCard(
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'>,
  now: Date = new Date()
): MirrorStyleLensSession {
  const stored = readStyleLensSession();
  if (stored && sessionMatchesCard(stored, card, now)) {
    return stored;
  }
  const fresh = createDefaultStyleLensSession(card, now);
  saveStyleLensSession(fresh);
  return fresh;
}

export function resetStyleLensSessionForCard(
  card: Pick<DailyMirrorCardModel, 'date' | 'visual'>,
  now: Date = new Date()
): MirrorStyleLensSession {
  const fresh = createDefaultStyleLensSession(card, now);
  saveStyleLensSession(fresh);
  return fresh;
}

/** Plus — advance to next lens before generating a new scene. */
export function advanceStyleLensSession(
  session: MirrorStyleLensSession
): MirrorStyleLensSession {
  const next: MirrorStyleLensSession = {
    ...session,
    selectedStyleLensId: getNextStyleLensId(session.selectedStyleLensId),
    sceneVariationIndex: session.sceneVariationIndex + 1,
  };
  saveStyleLensSession(next);
  return next;
}

export function resolveLensForGeneration(
  isPlus: boolean,
  session: MirrorStyleLensSession
): { lensId: StyleLensId; variationIndex: number } {
  if (!isPlus) {
    return { lensId: DEFAULT_STYLE_LENS_ID, variationIndex: session.sceneVariationIndex };
  }
  return {
    lensId: session.selectedStyleLensId,
    variationIndex: session.sceneVariationIndex,
  };
}

export function getStyleLensDisplayLabel(lensId: StyleLensId): string {
  return getStyleLens(lensId).shortLabel;
}
