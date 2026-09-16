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

export async function hydrateYansiSaveStore(): Promise<boolean> {
  const result = await fetchMySavedYansilar({ limit: 48, offset: 0 });
  if (!result.ok) {
    setSnapshot({
      ready: true,
      items: [],
      savedBySlug: cloneMap(snapshot.savedBySlug),
      pendingBySlug: cloneMap(snapshot.pendingBySlug),
    });
    return false;
  }
  const savedBySlug = new Map<string, boolean>();
  for (const item of result.data.items) {
    savedBySlug.set(item.slug.trim().toLowerCase(), true);
  }
  setSnapshot({
    ready: true,
    items: result.data.items,
    savedBySlug,
    pendingBySlug: new Map(),
  });
  return true;
}
