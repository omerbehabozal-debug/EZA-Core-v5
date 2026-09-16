/**
 * Slice 5 — client authority for Meraklarım + per-slug saved flags.
 * Server list is source of truth; local map is for active-/m race safety.
 */

import {
  fetchMySavedYansilar,
  type SavedYansiListItem,
} from '@/lib/eza/mirror-network/yansiSaveApi';

type Snapshot = {
  ready: boolean;
  items: SavedYansiListItem[];
  savedBySlug: Map<string, boolean>;
  pendingBySlug: Map<string, 'save' | 'unsave'>;
};

const listeners = new Set<() => void>();

let snapshot: Snapshot = {
  ready: false,
  items: [],
  savedBySlug: new Map(),
  pendingBySlug: new Map(),
};

let version = 0;

/** Backend page size used by Meraklarım hydration (not a product inventory cap). */
export const YANSI_SAVE_HYDRATE_PAGE_SIZE = 48;

/**
 * Defensive page ceiling — prevents infinite pagination loops.
 * 50 × 48 = 2400 saves; not a silent 48-item product limit.
 */
export const YANSI_SAVE_HYDRATE_MAX_PAGES = 50;

function emit(): void {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

function cloneMap<K, V>(source: Map<K, V>): Map<K, V> {
  return new Map(source);
}

function setSnapshot(next: Snapshot): void {
  snapshot = next;
  emit();
}

function commitHydratedItems(items: SavedYansiListItem[]): void {
  const savedBySlug = new Map<string, boolean>();
  for (const item of items) {
    const slug = item.slug.trim().toLowerCase();
    if (!slug) continue;
    savedBySlug.set(slug, true);
  }
  setSnapshot({
    ready: true,
    items,
    savedBySlug,
    pendingBySlug: new Map(),
  });
}

export function getYansiSaveSnapshot(): Snapshot {
  return {
    ready: snapshot.ready,
    items: [...snapshot.items],
    savedBySlug: cloneMap(snapshot.savedBySlug),
    pendingBySlug: cloneMap(snapshot.pendingBySlug),
  };
}

/** Stable primitive for useSyncExternalStore (avoid cloning in getSnapshot). */
export function getYansiSaveStoreVersion(): number {
  return version;
}

export function subscribeYansiSaveStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearYansiSaveStore(): void {
  setSnapshot({
    ready: false,
    items: [],
    savedBySlug: new Map(),
    pendingBySlug: new Map(),
  });
}

export function isYansiSavedInStore(slug: string): boolean {
  const key = slug.trim().toLowerCase();
  if (!key) return false;
  if (snapshot.savedBySlug.has(key)) return Boolean(snapshot.savedBySlug.get(key));
  return snapshot.items.some((item) => item.slug === key);
}

export function isYansiSavePending(slug: string): boolean {
  const key = slug.trim().toLowerCase();
  return Boolean(key && snapshot.pendingBySlug.has(key));
}

export function noteYansiSaveState(slug: string, saved: boolean): void {
  const key = slug.trim().toLowerCase();
  if (!key) return;
  const savedBySlug = cloneMap(snapshot.savedBySlug);
  savedBySlug.set(key, saved);
  let items = snapshot.items;
  if (!saved) {
    items = items.filter((item) => item.slug !== key);
  }
  setSnapshot({
    ...snapshot,
    items,
    savedBySlug,
  });
}

export function setYansiSavePending(
  slug: string,
  pending: 'save' | 'unsave' | null
): void {
  const key = slug.trim().toLowerCase();
  if (!key) return;
  const pendingBySlug = cloneMap(snapshot.pendingBySlug);
  if (!pending) pendingBySlug.delete(key);
  else pendingBySlug.set(key, pending);
  setSnapshot({ ...snapshot, pendingBySlug });
}

/**
 * Paginated Meraklarım hydrate.
 * Continues until a short page, total exhaustion, or defensive max pages.
 * Deduplicates by exact slug while preserving first-seen (server) order.
 */
export async function hydrateYansiSaveStore(): Promise<boolean> {
  const pageSize = YANSI_SAVE_HYDRATE_PAGE_SIZE;
  const merged: SavedYansiListItem[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < YANSI_SAVE_HYDRATE_MAX_PAGES; page += 1) {
    const offset = page * pageSize;
    const result = await fetchMySavedYansilar({ limit: pageSize, offset });
    if (!result.ok) {
      if (page === 0) {
        // Preserve prior optimistic savedBySlug flags; do not invent inventory.
        setSnapshot({
          ready: true,
          items: [],
          savedBySlug: cloneMap(snapshot.savedBySlug),
          pendingBySlug: cloneMap(snapshot.pendingBySlug),
        });
        return false;
      }
      // Later page failed — keep already hydrated pages (least destructive).
      commitHydratedItems(merged);
      return false;
    }

    const batch = result.data.items;
    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i]!;
      const slug = item.slug.trim().toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      merged.push({ ...item, slug });
    }

    if (batch.length < pageSize) break;
    if (
      typeof result.data.total === 'number' &&
      result.data.total >= 0 &&
      merged.length >= result.data.total
    ) {
      break;
    }
  }

  commitHydratedItems(merged);
  return true;
}
