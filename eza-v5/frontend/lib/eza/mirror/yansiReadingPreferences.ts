/** Local presentation only: never sent to analytics, the account, or an API. */
export type YansiReadingPreferences = {
  mode: 'standard' | 'editorial';
  fontSize: number;
  spacing: 'normal' | 'roomy';
};
export const YANSI_READING_STORAGE_KEY = 'bilign:yansi-reading:v1';
export const DEFAULT_YANSI_READING: YansiReadingPreferences = { mode: 'standard', fontSize: 16, spacing: 'normal' };

export function normalizeYansiReading(value: unknown): YansiReadingPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_YANSI_READING };
  const candidate = value as Partial<YansiReadingPreferences>;
  if ((candidate.mode !== 'standard' && candidate.mode !== 'editorial') ||
    (candidate.spacing !== 'normal' && candidate.spacing !== 'roomy') ||
    !Number.isInteger(candidate.fontSize) || candidate.fontSize! < 16 || candidate.fontSize! > 24) {
    return { ...DEFAULT_YANSI_READING };
  }
  return { mode: candidate.mode, fontSize: candidate.fontSize!, spacing: candidate.spacing };
}

export function readYansiReading(): YansiReadingPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_YANSI_READING };
  try { return normalizeYansiReading(JSON.parse(window.localStorage.getItem(YANSI_READING_STORAGE_KEY) || 'null')); }
  catch { return { ...DEFAULT_YANSI_READING }; }
}

export function writeYansiReading(value: YansiReadingPreferences): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(YANSI_READING_STORAGE_KEY, JSON.stringify(normalizeYansiReading(value))); }
  catch { /* Storage can be denied or full; the session preference still works. */ }
}
