import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  mirrorOriginHasPrivateLeak,
  startMirrorGuestChat,
} from '@/lib/eza/mirror-network/mirrorGuestConversation';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import { getChatArchive } from '@/lib/standaloneChatArchive';
import { createStandaloneChat } from '@/lib/standaloneChatArchive';

vi.mock('@/lib/eza/mirror-network/fetchPublicMirror', () => ({
  fetchPublicMirrorBySlug: vi.fn(() => {
    throw new Error('fetchPublicMirrorBySlug must not be called in guest chat flow');
  }),
}));

const SAMPLE_SESSION: MirrorSohbetSession = {
  sessionId: 'sess-1',
  guestToken: 'guest-token-abcdefghijklmnop',
  mirrorSlug: 'sokak-lambalari-test',
  cardTitle: 'Sokak Lambaları',
  openingMessage:
    "Bu Ayna, Kyoto'nun akşam ritmini keşfetme merakından doğdu.\n\nŞimdi bu yolculuk senin sorularınla devam ediyor.",
  thoughtCards: [{ id: 'thought-1', label: 'Akşam sokaklarını keşfet' }],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  parentMirrorId: 'sokak-lambalari-test',
  rootMirrorId: 'sokak-lambalari-test',
  seedTopic: 'Sokak Lambaları',
  seedCategory: 'travel',
  seedMood: 'discovery',
  sceneImageUrl: 'https://picsum.photos/seed/mirror-guest-scene/1080/1350',
};

describe('mirror guest conversation (Stage 2B slice 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('hook card message becomes pending chat message, not textarea prefill', () => {
    const hookLabel = 'Akşam sokaklarını keşfet';
    const created = startMirrorGuestChat({
      session: SAMPLE_SESSION,
      firstUserMessage: hookLabel,
    });
    expect(created).not.toBeNull();

    const chat = getChatArchive(created!.chatId);
    expect(chat?.mirrorOrigin?.pendingUserMessage).toBe(hookLabel);
    expect(chat?.messages.some((m) => m.isUser && m.text === hookLabel)).toBe(false);
    expect(chat?.messages.some((m) => !m.isUser && m.text.includes('Bu Ayna,'))).toBe(true);
  });

  it('marks root mirror as discover-experienced when guest chat starts', () => {
    const sessionWithParent: MirrorSohbetSession = {
      ...SAMPLE_SESSION,
      mirrorSlug: 'child-mirror',
      parentMirrorId: 'parent-mirror',
      rootMirrorId: 'root-mirror',
    };
    startMirrorGuestChat({
      session: sessionWithParent,
      firstUserMessage: 'Şehri yavaşça oku',
    });

    const raw = localStorage.getItem('eza_discover_experienced_mirror_slugs');
    expect(raw).toContain('root-mirror');
    expect(raw).not.toContain('child-mirror');
  });

  it('writes guest conversation metadata with mirror lineage ids', () => {
    const sessionWithParent: MirrorSohbetSession = {
      ...SAMPLE_SESSION,
      mirrorSlug: 'child-mirror',
      parentMirrorId: 'parent-mirror',
      rootMirrorId: 'root-mirror',
    };
    const created = startMirrorGuestChat({
      session: sessionWithParent,
      firstUserMessage: 'Şehri yavaşça oku',
    });
    const origin = getChatArchive(created!.chatId)?.mirrorOrigin;
    const chat = getChatArchive(created!.chatId);
    expect(created?.groupId).toBeTruthy();
    expect(chat?.groupId).toBe(created?.groupId);
    expect(origin?.startedFromMirrorId).toBe('child-mirror');
    expect(origin?.parentMirrorId).toBe('parent-mirror');
    expect(origin?.rootMirrorId).toBe('root-mirror');
    expect(origin?.seedTopic).toBe('Sokak Lambaları');
    expect(origin?.seedCategory).toBe('travel');
    expect(origin?.seedMood).toBe('discovery');
    expect(origin?.isGuestSession).toBe(true);
    expect(origin?.autoReplyPending).toBe(true);
  });

  it('does not leak private mirror fields into stored origin', () => {
    const created = startMirrorGuestChat({
      session: SAMPLE_SESSION,
      firstUserMessage: 'Merak kartı mesajı',
    });
    const origin = getChatArchive(created!.chatId)?.mirrorOrigin;
    expect(origin).toBeTruthy();
    expect(mirrorOriginHasPrivateLeak(origin!)).toBe(false);
    const json = JSON.stringify(getChatArchive(created!.chatId));
    expect(json).not.toContain('mirrorBody');
    expect(json).not.toContain('conversationId');
    expect(json).not.toContain('userId');
    expect(json).not.toContain('coreCuriosity');
  });

  it('preserves opening assistant message without original mirror conversation', () => {
    const created = startMirrorGuestChat({
      session: SAMPLE_SESSION,
      firstUserMessage: 'Kendi sorum',
    });
    const chat = getChatArchive(created!.chatId);
    expect(chat?.messages).toHaveLength(1);
    expect(chat?.messages[0].isUser).toBe(false);
    expect(chat?.messages[0].text).toContain('senin sorularınla devam ediyor');
  });

  it('does not alter normal standalone chat creation', () => {
    const id = createStandaloneChat();
    const chat = getChatArchive(id);
    expect(chat?.mirrorOrigin).toBeUndefined();
    expect(chat?.messages).toHaveLength(0);
  });

  it('writes guest scene identity from session.sceneImageUrl without public mirror fetch', async () => {
    const created = startMirrorGuestChat({
      session: SAMPLE_SESSION,
      firstUserMessage: 'Akşam sokaklarını keşfet',
    });
    expect(created).not.toBeNull();

    const chat = getChatArchive(created!.chatId);
    expect(chat?.conversationSceneUrl).toBe(SAMPLE_SESSION.sceneImageUrl);
    expect(chat?.conversationSceneSource).toBe('mirror_guest');
    expect(chat?.conversationSceneSlug).toBe('sokak-lambalari-test');

    const { fetchPublicMirrorBySlug } = await import('@/lib/eza/mirror-network/fetchPublicMirror');
    expect(fetchPublicMirrorBySlug).not.toHaveBeenCalled();
  });

  it('skips scene identity when session sceneImageUrl is not persistable', () => {
    const created = startMirrorGuestChat({
      session: { ...SAMPLE_SESSION, sceneImageUrl: 'data:image/png;base64,abc' },
      firstUserMessage: 'Test',
    });
    const chat = getChatArchive(created!.chatId);
    expect(chat?.conversationSceneUrl).toBeUndefined();
    expect(chat?.conversationSceneSource).toBeUndefined();
  });
});
