/**
 * Client-side Free plan — ayda 1 Daily Mirror oluşturma hakkı (mock).
 * Gerçek quota Sprint 3+ / server entitlement ile değiştirilecek.
 */

export const FREE_MIRROR_USAGE_STORAGE_KEY = 'eza_free_mirror_usage';

export type FreeMirrorUsageRecord = {
  monthKey: string;
  used: boolean;
  createdAt?: string;
  mirrorDate?: string;
};

function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function readRecord(): FreeMirrorUsageRecord | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(FREE_MIRROR_USAGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FreeMirrorUsageRecord;
    if (!parsed || typeof parsed.monthKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(record: FreeMirrorUsageRecord): void {
  const ls = storage();
  if (!ls) return;
  ls.setItem(FREE_MIRROR_USAGE_STORAGE_KEY, JSON.stringify(record));
}

/** Bu takvim ayında ücretsiz tam ayna oluşturma hakkı var mı? */
export function canCreateFreeMirrorThisMonth(now: Date = new Date()): boolean {
  const key = monthKeyFromDate(now);
  const record = readRecord();
  if (!record || record.monthKey !== key) return true;
  return !record.used;
}

/** Free kullanıcının aylık hakkını tüket (Plus'ta no-op). */
export function markFreeMirrorUsed(mirrorDate: string, now: Date = new Date()): void {
  writeRecord({
    monthKey: monthKeyFromDate(now),
    used: true,
    createdAt: now.toISOString(),
    mirrorDate,
  });
}

/** Sonraki ücretsiz hakkın başlangıç tarihi (ayın 1'i). */
export function getNextFreeMirrorResetDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

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
