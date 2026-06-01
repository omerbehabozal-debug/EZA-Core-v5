/**
 * Client-side Free plan — günde 1 tam Daily Mirror oluşturma hakkı (mock).
 * Gerçek quota Sprint 3+ / server entitlement ile değiştirilecek.
 */

export const FREE_MIRROR_USAGE_STORAGE_KEY = 'eza_free_mirror_usage';

export type FreeMirrorUsageRecord = {
  dayKey: string;
  used: boolean;
  createdAt?: string;
  mirrorDate?: string;
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

function normalizeRecord(parsed: unknown): FreeMirrorUsageRecord | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.dayKey === 'string' && typeof raw.used === 'boolean') {
    return {
      dayKey: raw.dayKey,
      used: raw.used,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      mirrorDate: typeof raw.mirrorDate === 'string' ? raw.mirrorDate : undefined,
    };
  }
  /** Eski aylık kayıt (monthKey) — günlük modele geçişte yok sayılır */
  return null;
}

function readRecord(): FreeMirrorUsageRecord | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(FREE_MIRROR_USAGE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeRecord(record: FreeMirrorUsageRecord): void {
  const ls = storage();
  if (!ls) return;
  ls.setItem(FREE_MIRROR_USAGE_STORAGE_KEY, JSON.stringify(record));
}

/** Bugün ücretsiz tam ayna oluşturma hakkı var mı? */
export function canCreateFreeMirrorToday(now: Date = new Date()): boolean {
  const key = dayKeyFromDate(now);
  const record = readRecord();
  if (!record || record.dayKey !== key) return true;
  return !record.used;
}

/** Free kullanıcının günlük hakkını tüket (Plus'ta çağrılmamalı). */
export function markFreeMirrorUsedToday(mirrorDate: string, now: Date = new Date()): void {
  writeRecord({
    dayKey: dayKeyFromDate(now),
    used: true,
    createdAt: now.toISOString(),
    mirrorDate,
  });
}

/** Sonraki ücretsiz hak: yarın 00:00 (yerel). */
export function getNextFreeMirrorResetDate(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** UI — yarınki sıfırlanma tarihi (ör. "2 Haziran 2026"). */
export function formatNextFreeMirrorDate(
  now: Date = new Date(),
  locale = 'tr-TR'
): string {
  return getNextFreeMirrorResetDate(now).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Test / debug — kaydı sıfırla. */
export function clearFreeMirrorUsage(): void {
  storage()?.removeItem(FREE_MIRROR_USAGE_STORAGE_KEY);
}
