import { describe, expect, it } from 'vitest';
import { startMirrorGuestChat } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import {
  filterDiscoverMirrorsForViewer,
  hasCompletedMirrorVisual,
  markDiscoverMirrorCompletedForConversation,
  markDiscoverMirrorExperienced,
  normalizeDiscoverMirrorSlug,
  resolveExperiencedSlugFromChat,
  syncDiscoverExperiencedFromArchive,
} from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import type { ArchivedChat } from '@/lib/standaloneChatArchive';
import { getChatArchive } from '@/lib/standaloneChatArchive';

const GUEST_SESSION: MirrorSohbetSession = {
  sessionId: 'sess-1',
  guestToken: 'guest-token-abcdefghijklmnop',
  mirrorSlug: 'bmw-sport',
  cardTitle: 'BMW Sport',
  openingMessage: 'Bu Ayna bir meraktan doğdu.',
  thoughtCards: [{ id: 'thought-1', label: 'Motor sesi' }],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  parentMirrorId: 'bmw-sport',
  rootMirrorId: 'bmw-sport',
  seedTopic: 'BMW',
  seedCategory: 'auto',
  seedMood: 'discovery',
  sceneImageUrl: 'https://cdn.example/parent-scene.png',
};

describe('discoverExperiencedMirrors', () => {
  const sampleItems: DiscoverMirror[] = [
    { slug: 'bmw-sport', title: 'BMW', sceneImageUrl: 'https://cdn/a.png', yansiCount: 3 },
    { slug: 'japan-kyoto', title: 'Japonya', sceneImageUrl: 'https://cdn/b.png', yansiCount: 1 },
    { slug: 'space-orbit', title: 'Uzay', sceneImageUrl: 'https://cdn/c.png', yansiCount: 0 },
  ];

  const mirrorLineage = {
    sourceType: 'mirror' as const,
    startedFromMirrorId: 'bmw-sport',
    rootMirrorId: 'bmw-sport',
  };

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

  it('does not complete guest sohbet with parent mirror_guest scene identity', () => {
    const created = startMirrorGuestChat({
      session: GUEST_SESSION,
      firstUserMessage: 'Motor sesi hakkında konuşalım',
    });
    expect(created).not.toBeNull();

    const chat = getChatArchive(created!.chatId)!;
    expect(chat.conversationSceneSource).toBe('mirror_guest');
    expect(chat.conversationSceneUrl).toBe(GUEST_SESSION.sceneImageUrl);
    expect(hasCompletedMirrorVisual(chat)).toBe(false);
    expect(resolveExperiencedSlugFromChat(chat)).toBeNull();

    localStorage.setItem('eza_standalone_chat_archive', JSON.stringify([chat]));
    syncDiscoverExperiencedFromArchive();
    expect(localStorage.getItem('eza_discover_experienced_mirror_slugs')).toBeNull();

    const visible = filterDiscoverMirrorsForViewer(sampleItems);
    expect(visible.map((item) => item.slug)).toEqual(['bmw-sport', 'japan-kyoto', 'space-orbit']);
  });

  it('completes when user-produced scene uses mirror_local', () => {
    const chat = {
      id: 'chat-local',
      title: 'Done',
      preview: '',
      savedAt: '',
      messageCount: 4,
      messages: [],
      conversationSceneUrl: 'https://cdn.example/child-scene.png',
      conversationSceneSource: 'mirror_local',
      treeMetadata: mirrorLineage,
    } as ArchivedChat;

    expect(hasCompletedMirrorVisual(chat)).toBe(true);
    expect(resolveExperiencedSlugFromChat(chat)).toBe('bmw-sport');

    localStorage.setItem('eza_standalone_chat_archive', JSON.stringify([chat]));
    const visible = filterDiscoverMirrorsForViewer(sampleItems);
    expect(visible.map((item) => item.slug)).toEqual(['japan-kyoto', 'space-orbit']);
  });

  it('completes after publish when scene source is mirror_network', () => {
    const chat = {
      id: 'chat-network',
      title: 'Published',
      preview: '',
      savedAt: '',
      messageCount: 4,
      messages: [],
      conversationSceneUrl: 'https://cdn.example/published-scene.png',
      conversationSceneSource: 'mirror_network',
      treeMetadata: mirrorLineage,
    } as ArchivedChat;

    expect(hasCompletedMirrorVisual(chat)).toBe(true);
    expect(resolveExperiencedSlugFromChat(chat)).toBe('bmw-sport');
  });

  it('does not complete without persistable URL', () => {
    const chat = {
      id: 'chat-bad-url',
      title: 'Bad',
      preview: '',
      savedAt: '',
      messageCount: 1,
      messages: [],
      conversationSceneUrl: 'data:image/png;base64,abc',
      conversationSceneSource: 'mirror_local',
      treeMetadata: mirrorLineage,
    } as ArchivedChat;

    expect(hasCompletedMirrorVisual(chat)).toBe(false);
    expect(resolveExperiencedSlugFromChat(chat)).toBeNull();
  });

  it('does not complete with mirror lineage but no scene URL', () => {
    const chat = {
      id: 'chat-1',
      title: 'Guest',
      preview: '',
      savedAt: '',
      messageCount: 1,
      messages: [],
      treeMetadata: mirrorLineage,
    } as ArchivedChat;

    expect(hasCompletedMirrorVisual(chat)).toBe(false);
    expect(resolveExperiencedSlugFromChat(chat)).toBeNull();
  });

  it('marks discover completion from conversation after mirror_local identity is saved', () => {
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
