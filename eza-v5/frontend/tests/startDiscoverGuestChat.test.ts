import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SAINA_DISCOVER_CTA } from '@/lib/eza/mirror-network/discoverCopy';
import { startDiscoverGuestChatFromSlug } from '@/lib/eza/mirror-network/startDiscoverGuestChat';

const createMirrorSohbetSession = vi.fn();
const startMirrorGuestChat = vi.fn();

vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({
  createMirrorSohbetSession: (...args: unknown[]) => createMirrorSohbetSession(...args),
}));

vi.mock('@/lib/eza/mirror-network/mirrorGuestConversation', () => ({
  MIRROR_GUEST_CHAT_REPLY_PARAM: 'mirrorReply',
  startMirrorGuestChat: (...args: unknown[]) => startMirrorGuestChat(...args),
}));

vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({
  trackSeedStart: vi.fn(),
  trackGuestConversationStarted: vi.fn(),
}));

describe('startDiscoverGuestChatFromSlug', () => {
  beforeEach(() => {
    createMirrorSohbetSession.mockReset();
    startMirrorGuestChat.mockReset();
  });

  it('creates session and returns standalone chat href', async () => {
    createMirrorSohbetSession.mockResolvedValue({
      ok: true,
      session: {
        mirrorSlug: 'kyoto',
        guestToken: 'guest-1',
        openingMessage: 'Merhaba',
        thoughtCards: [],
        cardTitle: 'Kyoto',
        parentMirrorId: null,
        rootMirrorId: 'kyoto',
        seedTopic: 'kyoto',
        seedCategory: 'travel',
        seedMood: 'curiosity',
        sceneImageUrl: null,
      },
    });
    startMirrorGuestChat.mockReturnValue({ chatId: 'chat-9', groupId: 'g1', mirrorOrigin: {} });

    const result = await startDiscoverGuestChatFromSlug('kyoto', SAINA_DISCOVER_CTA, 'Kyoto Yolculuğu');

    expect(result).toEqual({
      ok: true,
      chatId: 'chat-9',
      href: '/standalone?chat=chat-9&mirrorReply=1',
    });
    expect(startMirrorGuestChat).toHaveBeenCalledWith({
      session: expect.objectContaining({ mirrorSlug: 'kyoto' }),
      firstUserMessage: SAINA_DISCOVER_CTA,
      chatTitle: 'Kyoto Yolculuğu',
    });
  });
});
