import { describe, expect, it } from 'vitest';
import {
  filterDiscoverMirrorsForViewer,
  hasCompletedMirrorVisual,
  markDiscoverMirrorCompletedForConversation,
  markDiscoverMirrorExperienced,
  normalizeDiscoverMirrorSlug,
  resolveExperiencedSlugFromChat,
} from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import type { ArchivedChat } from '@/lib/standaloneChatArchive';

describe('discoverExperiencedMirrors', () => {
  const sampleItems: DiscoverMirror[] = [
    { slug: 'bmw-sport', title: 'BMW', sceneImageUrl: 'https://cdn/a.png', yansiCount: 3 },
    { slug: 'japan-kyoto', title: 'Japonya', sceneImageUrl: 'https://cdn/b.png', yansiCount: 1 },
    { slug: 'space-orbit', title: 'Uzay', sceneImageUrl: 'https://cdn/c.png', yansiCount: 0 },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes mirror slugs for stable matching', () => {
    expect(normalizeDiscoverMirrorSlug(' BMW-Sport ')).toBe('bmw-sport');
  });

  it('hides experienced root slugs from the default discover view', () => {
    markDiscoverMirrorExperienced('bmw-sport');
    const visible = filterDiscoverMirrorsForViewer(sampleItems);
    expect(visible.map((item) => item.slug)).toEqual(['japan-kyoto', 'space-orbit']);
  });

  it('does not treat mirror lineage without visual as completed', () => {
    const chat = {
      id: 'chat-1',
      title: 'Guest',
      preview: '',
      savedAt: '',
      messageCount: 1,
      messages: [],
      treeMetadata: {
        sourceType: 'mirror',
        startedFromMirrorId: 'bmw-sport',
        rootMirrorId: 'bmw-sport',
      },
    } as ArchivedChat;

    expect(hasCompletedMirrorVisual(chat)).toBe(false);
    expect(resolveExperiencedSlugFromChat(chat)).toBeNull();
    localStorage.setItem('eza_standalone_chat_archive', JSON.stringify([chat]));

    const visible = filterDiscoverMirrorsForViewer(sampleItems);
    expect(visible.map((item) => item.slug)).toEqual(['bmw-sport', 'japan-kyoto', 'space-orbit']);
  });

  it('syncs completed journeys from archive conversation scene identity', () => {
    const chat = {
      id: 'chat-2',
      title: 'Done',
      preview: '',
      savedAt: '',
      messageCount: 4,
      messages: [],
      conversationSceneUrl: 'https://cdn.example/scene.png',
      conversationSceneSource: 'mirror_local',
      treeMetadata: {
        sourceType: 'mirror',
        startedFromMirrorId: 'bmw-sport',
        rootMirrorId: 'bmw-sport',
      },
    } as ArchivedChat;

    expect(resolveExperiencedSlugFromChat(chat)).toBe('bmw-sport');
    localStorage.setItem('eza_standalone_chat_archive', JSON.stringify([chat]));

    const visible = filterDiscoverMirrorsForViewer(sampleItems);
    expect(visible.map((item) => item.slug)).toEqual(['japan-kyoto', 'space-orbit']);
  });

  it('marks discover completion from conversation after visual identity is saved', () => {
    const chat = {
      id: 'chat-3',
      title: 'Done',
      preview: '',
      savedAt: '',
      messageCount: 4,
      messages: [],
      conversationSceneUrl: 'https://cdn.example/scene.png',
      conversationSceneSource: 'mirror_local',
      treeMetadata: {
        sourceType: 'mirror',
        startedFromMirrorId: 'japan-kyoto',
        rootMirrorId: 'japan-kyoto',
      },
    } as ArchivedChat;
    localStorage.setItem('eza_standalone_chat_archive', JSON.stringify([chat]));

    markDiscoverMirrorCompletedForConversation('chat-3');

    const raw = localStorage.getItem('eza_discover_experienced_mirror_slugs');
    expect(raw).toContain('japan-kyoto');
  });
});
