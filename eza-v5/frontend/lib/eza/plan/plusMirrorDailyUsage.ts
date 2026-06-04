/**
 * P4-D — Plus Daily Mirror production quota (client-side v1).
 * Share / download / copy do not consume this quota.
 */

export const PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY = 'eza_plus_mirror_daily_usage_v1';

export const PLUS_MIRROR_DAILY_PRODUCTION_LIMIT = 10;

export type PlusMirrorProductionActionType = 'create_card' | 'update_mirror' | 'new_scene';

export type PlusMirrorDailyUsage = {
  dayKey: string;
  used: number;
  limit: number;
  actions: Array<{
    type: PlusMirrorProductionActionType;
    at: string;
  }>;
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

function normalize(parsed: unknown, now: Date): PlusMirrorDailyUsage | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.dayKey !== 'string') return null;
  if (raw.dayKey !== dayKeyFromDate(now)) return null;
  const used = typeof raw.used === 'number' ? Math.max(0, Math.floor(raw.used)) : 0;
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .filter(
          (a): a is { type: PlusMirrorProductionActionType; at: string } =>
            !!a &&
            typeof a === 'object' &&
            typeof (a as { at?: string }).at === 'string' &&
            (['create_card', 'update_mirror', 'new_scene'] as string[]).includes(
              String((a as { type?: string }).type)
            )
        )
        .map((a) => ({
          type: a.type as PlusMirrorProductionActionType,
          at: a.at,
        }))
    : [];
  return {
    dayKey: raw.dayKey,
    used,
    limit: PLUS_MIRROR_DAILY_PRODUCTION_LIMIT,
    actions,
  };
}

function readUsage(now: Date = new Date()): PlusMirrorDailyUsage {
  const ls = storage();
  const dayKey = dayKeyFromDate(now);
  if (!ls) {
    return { dayKey, used: 0, limit: PLUS_MIRROR_DAILY_PRODUCTION_LIMIT, actions: [] };
  }
  try {
    const raw = ls.getItem(PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY);
    if (!raw) {
      return { dayKey, used: 0, limit: PLUS_MIRROR_DAILY_PRODUCTION_LIMIT, actions: [] };
    }
    return (
      normalize(JSON.parse(raw), now) ?? {
        dayKey,
        used: 0,
        limit: PLUS_MIRROR_DAILY_PRODUCTION_LIMIT,
        actions: [],
      }
    );
  } catch {
    return { dayKey, used: 0, limit: PLUS_MIRROR_DAILY_PRODUCTION_LIMIT, actions: [] };
  }
}

function writeUsage(record: PlusMirrorDailyUsage): void {
  storage()?.setItem(PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY, JSON.stringify(record));
}

export function getPlusMirrorProductionUsed(now: Date = new Date()): number {
  return readUsage(now).used;
}

export function getPlusMirrorProductionRemaining(now: Date = new Date()): number {
  const usage = readUsage(now);
  return Math.max(0, usage.limit - usage.used);
}

export function canConsumePlusMirrorProduction(now: Date = new Date()): boolean {
  return getPlusMirrorProductionRemaining(now) > 0;
}

export function consumePlusMirrorProduction(
  type: PlusMirrorProductionActionType,
  now: Date = new Date()
): boolean {
  if (!canConsumePlusMirrorProduction(now)) return false;
  const usage = readUsage(now);
  const next: PlusMirrorDailyUsage = {
    dayKey: usage.dayKey,
    used: usage.used + 1,
    limit: usage.limit,
    actions: [...usage.actions, { type, at: now.toISOString() }],
  };
  writeUsage(next);
  return true;
}

export function formatPlusMirrorQuotaHint(remaining: number): string {
  if (remaining <= 0) {
    return 'Bugünkü üretim hakkın doldu. Mevcut kartını paylaşabilir veya indirebilirsin.';
  }
  if (remaining === 1) {
    return 'Bugün 1 üretim hakkın kaldı.';
  }
  return `Bugün ${remaining} üretim hakkın kaldı.`;
}

export function clearPlusMirrorDailyUsage(): void {
  storage()?.removeItem(PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY);
}
