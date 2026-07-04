/**
 * Keşfet — locally experienced root Aynalar (client-only hide list).
 * Does not mutate Mirror Network; only filters the default Discover view.
 */

import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  type ArchivedChat,
  readChatArchives,
} from '@/lib/standaloneChatArchive';

export const DISCOVER_EXPERIENCED_STORAGE_KEY = 'eza_discover_experienced_mirror_slugs';
const MAX_EXPERIENCED_SLUGS = 250;
const DEFAULT_VIEWER_TARGET = 24;
const VIEWER_PAGE_SIZE = 24;
const MAX_VIEWER_PAGES = 6;

export function normalizeDiscoverMirrorSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function readExperiencedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISCOVER_EXPERIENCED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { slugs?: unknown };
    if (!Array.isArray(parsed.slugs)) return new Set();
    return new Set(
      parsed.slugs
        .filter((value): value is string => typeof value === 'string')
        .map(normalizeDiscoverMirrorSlug)
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function writeExperiencedSet(slugs: Set<string>): void {
  if (typeof window === 'undefined') return;
  const list = Array.from(slugs).slice(0, MAX_EXPERIENCED_SLUGS);
  localStorage.setItem(DISCOVER_EXPERIENCED_STORAGE_KEY, JSON.stringify({ slugs: list }));
}

export function listDiscoverExperiencedMirrorSlugs(): string[] {
  syncDiscoverExperiencedFromArchive();
  return Array.from(readExperiencedSet());
}

export function markDiscoverMirrorExperienced(slug: string): void {
  const normalized = normalizeDiscoverMirrorSlug(slug);
  if (!normalized) return;
  const set = readExperiencedSet();
  if (set.has(normalized)) return;
  set.add(normalized);
  writeExperiencedSet(set);
}

export function resolveExperiencedSlugFromChat(chat: ArchivedChat): string | null {
  const tree = chat.treeMetadata;
  const origin = chat.mirrorOrigin;
  const raw =
    tree?.rootMirrorId ??
    tree?.startedFromMirrorId ??
    origin?.rootMirrorId ??
    origin?.startedFromMirrorId;
  if (!raw?.trim()) return null;
  return normalizeDiscoverMirrorSlug(raw);
}

/** Merge archive lineage into the hide list (guest merge, login, existing sessions). */
export function syncDiscoverExperiencedFromArchive(): void {
  if (typeof window === 'undefined') return;
  const set = readExperiencedSet();
  let changed = false;
  for (const chat of readChatArchives()) {
    const slug = resolveExperiencedSlugFromChat(chat);
    if (!slug || set.has(slug)) continue;
    set.add(slug);
    changed = true;
  }
  if (changed) writeExperiencedSet(set);
}

export function filterDiscoverMirrorsForViewer(items: DiscoverMirror[]): DiscoverMirror[] {
  syncDiscoverExperiencedFromArchive();
  const hidden = readExperiencedSet();
  return items.filter((item) => !hidden.has(normalizeDiscoverMirrorSlug(item.slug)));
}

export async function fetchDiscoverMirrorsForViewer(options?: {
  targetCount?: number;
}): Promise<
  | { ok: true; items: DiscoverMirror[]; totalAvailable: number; allExperienced: boolean }
  | { ok: false; status: number }
> {
  const targetCount = options?.targetCount ?? DEFAULT_VIEWER_TARGET;
  syncDiscoverExperiencedFromArchive();
  const hidden = readExperiencedSet();

  const visible: DiscoverMirror[] = [];
  let offset = 0;
  let totalAvailable = 0;

  for (let page = 0; page < MAX_VIEWER_PAGES; page += 1) {
    const result = await fetchDiscoverMirrors({
      limit: VIEWER_PAGE_SIZE,
      offset,
      revalidateSeconds: 0,
    });
    if (!result.ok) {
      return visible.length > 0
        ? {
            ok: true,
            items: visible,
            totalAvailable,
            allExperienced: totalAvailable > 0 && visible.length === 0,
          }
        : { ok: false, status: result.status };
    }

    totalAvailable = result.data.total;
    if (result.data.items.length === 0) break;

    for (const item of result.data.items) {
      if (hidden.has(normalizeDiscoverMirrorSlug(item.slug))) continue;
      visible.push(item);
      if (visible.length >= targetCount) {
        return {
          ok: true,
          items: visible,
          totalAvailable,
          allExperienced: false,
        };
      }
    }

    offset += VIEWER_PAGE_SIZE;
    if (offset >= totalAvailable) break;
  }

  return {
    ok: true,
    items: visible,
    totalAvailable,
    allExperienced: totalAvailable > 0 && visible.length === 0,
  };
}
