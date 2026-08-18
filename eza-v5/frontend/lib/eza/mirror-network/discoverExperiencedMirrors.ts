/**
 * Keşfet — locally experienced root Aynalar (client-only hide list).
 * Rastlantısal (random) may skip locally completed slugs as repetition reduction.
 * En Yeni and Güçlü Merak do not use this hide list — they must not become
 * “newest except whatever this browser already experienced”.
 * This is client-only hide-list filtering, not personalization.
 *
 * Hide rule: user completed their own mirror visual (Ayna/Yansı), not merely opened sohbet.
 */

import type { DiscoverMode } from '@/lib/eza/mirror-network/discoverModes';
import { DEFAULT_DISCOVER_MODE, shouldHideExperiencedDiscoverItems } from '@/lib/eza/mirror-network/discoverModes';
import {
  DISCOVER_PAGE_SIZE,
  canRequestDiscoverOffset,
  discoverPageHasMore,
  nextDiscoverPageOffset,
} from '@/lib/eza/mirror-network/discoverFeed';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import { fetchDiscoverMirrors } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  isPersistableConversationSceneUrl,
  type ConversationSceneSource,
} from '@/lib/eza/conversationSceneIdentity';
import {
  type ArchivedChat,
  getChatArchive,
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

function isMirrorSourceChat(chat: ArchivedChat): boolean {
  if (chat.treeMetadata?.sourceType === 'mirror' || chat.treeMetadata?.sourceType === 'mirror_branch') {
    return true;
  }
  return Boolean(chat.mirrorOrigin?.startedFromMirrorId);
}

const COMPLETED_DISCOVER_SCENE_SOURCES = new Set<ConversationSceneSource>([
  'mirror_local',
  'mirror_network',
]);

export function hasCompletedMirrorVisual(chat: ArchivedChat): boolean {
  const url = chat.conversationSceneUrl;
  const source = chat.conversationSceneSource;
  if (!url || !isPersistableConversationSceneUrl(url)) return false;
  if (!source || !COMPLETED_DISCOVER_SCENE_SOURCES.has(source)) return false;
  return true;
}

export function resolveMirrorRootSlugFromChat(chat: ArchivedChat): string | null {
  if (!isMirrorSourceChat(chat)) return null;
  const tree = chat.treeMetadata;
  const origin = chat.mirrorOrigin;
  const raw =
    tree?.rootMirrorId ??
    origin?.rootMirrorId ??
    tree?.startedFromMirrorId ??
    origin?.startedFromMirrorId;
  if (!raw?.trim()) return null;
  return normalizeDiscoverMirrorSlug(raw);
}

/** Completed journey only — opening sohbet alone does not qualify. */
export function resolveExperiencedSlugFromChat(chat: ArchivedChat): string | null {
  if (!hasCompletedMirrorVisual(chat)) return null;
  return resolveMirrorRootSlugFromChat(chat);
}

/** Call when conversation mirror scene generation succeeds. */
export function markDiscoverMirrorCompletedForConversation(
  conversationId: string | undefined
): void {
  if (!conversationId) return;
  const chat = getChatArchive(conversationId);
  if (!chat) return;
  const slug = resolveExperiencedSlugFromChat(chat);
  if (!slug) return;
  markDiscoverMirrorExperienced(slug);
}

/** Merge completed mirror journeys from archive into the hide list. */
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

export function filterDiscoverMirrorsForViewer(
  items: DiscoverMirror[],
  mode: DiscoverMode = DEFAULT_DISCOVER_MODE
): DiscoverMirror[] {
  if (!shouldHideExperiencedDiscoverItems(mode)) {
    return items;
  }
  syncDiscoverExperiencedFromArchive();
  const hidden = readExperiencedSet();
  return items.filter((item) => !hidden.has(normalizeDiscoverMirrorSlug(item.slug)));
}

export type DiscoverPageForViewerResult =
  | {
      ok: true;
      items: DiscoverMirror[];
      rawCount: number;
      totalAvailable: number;
      allExperienced: boolean;
      mode: DiscoverMode;
      randomSession?: string | null;
      strongCuriosityReady: boolean;
      offset: number;
      nextOffset: number;
      hasMore: boolean;
    }
  | { ok: false; status: number };

/**
 * One Discover API page. Network fetch is not exposure.
 * Rastlantısal may hide locally completed slugs after the page arrives.
 */
export async function fetchDiscoverPageForViewer(options: {
  offset?: number;
  mode?: DiscoverMode;
  randomSession?: string | null;
  signal?: AbortSignal;
}): Promise<DiscoverPageForViewerResult> {
  const mode = options.mode ?? DEFAULT_DISCOVER_MODE;
  const offset = options.offset ?? 0;
  if (!canRequestDiscoverOffset(offset)) {
    return { ok: false, status: 0 };
  }

  const result = await fetchDiscoverMirrors({
    limit: DISCOVER_PAGE_SIZE,
    offset,
    revalidateSeconds: 0,
    mode,
    randomSession: mode === 'random' ? options.randomSession ?? null : null,
    signal: options.signal,
  });
  if (!result.ok) {
    return { ok: false, status: result.status };
  }

  const rawItems = result.data.items;
  const visible = filterDiscoverMirrorsForViewer(rawItems, result.data.mode);
  const nextOffset = nextDiscoverPageOffset(offset);
  const hasMore = discoverPageHasMore({
    offset,
    receivedCount: rawItems.length,
    total: result.data.total,
  });
  return {
    ok: true,
    items: visible,
    rawCount: rawItems.length,
    totalAvailable: result.data.total,
    allExperienced:
      shouldHideExperiencedDiscoverItems(result.data.mode) &&
      result.data.total > 0 &&
      visible.length === 0 &&
      !hasMore,
    mode: result.data.mode,
    randomSession: result.data.randomSession ?? options.randomSession ?? null,
    strongCuriosityReady: result.data.strongCuriosityReady,
    offset,
    nextOffset,
    hasMore,
  };
}

export async function fetchDiscoverMirrorsForViewer(options?: {
  targetCount?: number;
  mode?: DiscoverMode;
  randomSession?: string | null;
  signal?: AbortSignal;
}): Promise<
  | {
      ok: true;
      items: DiscoverMirror[];
      totalAvailable: number;
      allExperienced: boolean;
      mode: DiscoverMode;
      randomSession?: string | null;
      strongCuriosityReady: boolean;
    }
  | { ok: false; status: number }
> {
  const targetCount = options?.targetCount ?? DEFAULT_VIEWER_TARGET;
  const mode = options?.mode ?? DEFAULT_DISCOVER_MODE;
  const hideExperienced = shouldHideExperiencedDiscoverItems(mode);
  if (hideExperienced) {
    syncDiscoverExperiencedFromArchive();
  }
  const hidden = hideExperienced ? readExperiencedSet() : new Set<string>();

  const visible: DiscoverMirror[] = [];
  let offset = 0;
  let totalAvailable = 0;
  let randomSession = options?.randomSession ?? null;
  let strongCuriosityReady = false;

  const maxPages = hideExperienced ? MAX_VIEWER_PAGES : 1;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchDiscoverMirrors({
      limit: VIEWER_PAGE_SIZE,
      offset,
      revalidateSeconds: 0,
      mode,
      randomSession: mode === 'random' ? randomSession : null,
      signal: options?.signal,
    });
    if (!result.ok) {
      return visible.length > 0
        ? {
            ok: true,
            items: visible,
            totalAvailable,
            allExperienced: totalAvailable > 0 && visible.length === 0,
            mode,
            randomSession,
            strongCuriosityReady,
          }
        : { ok: false, status: result.status };
    }

    totalAvailable = result.data.total;
    randomSession = result.data.randomSession ?? randomSession;
    strongCuriosityReady = result.data.strongCuriosityReady;
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
          mode: result.data.mode,
          randomSession,
          strongCuriosityReady,
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
    allExperienced: hideExperienced && totalAvailable > 0 && visible.length === 0,
    mode,
    randomSession,
    strongCuriosityReady,
  };
}
