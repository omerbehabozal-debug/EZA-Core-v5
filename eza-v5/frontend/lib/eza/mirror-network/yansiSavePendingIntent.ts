/**
 * Slice 5 — one-shot pending Save intent across IdentityModal auth return.
 * sessionStorage only — never durable bookmark persistence.
 */

const STORAGE_KEY = 'eza_yansi_pending_save_v1';

export function setPendingYansiSaveIntent(slug: string): void {
  const key = slug.trim().toLowerCase();
  if (!key || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ slug: key, at: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function consumePendingYansiSaveIntent(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: string; at?: number };
    const slug = String(parsed?.slug || '')
      .trim()
      .toLowerCase();
    const at = Number(parsed?.at || 0);
    if (!slug) return null;
    // Expire after 30 minutes.
    if (at && Date.now() - at > 30 * 60 * 1000) return null;
    return slug;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
