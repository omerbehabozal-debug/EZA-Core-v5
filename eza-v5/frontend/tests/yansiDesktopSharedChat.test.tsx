import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';

const mocks = vi.hoisted(() => ({ create: vi.fn(), start: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({ createMirrorSohbetSession: mocks.create }));
vi.mock('@/lib/eza/mirror-network/mirrorGuestConversation', () => ({ startMirrorGuestChat: mocks.start, MIRROR_GUEST_CHAT_REPLY_PARAM: 'mirrorReply' }));
vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({ trackSeedStart: vi.fn(), trackGuestConversationStarted: vi.fn() }));

const identity = { title: 'Public başlık', displayName: 'Public yayıncı', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null };
const artifact = () => parsePublicFrozenJourneyArtifact({
  slug: 'shared-chat', journeyId: 'shared-chat', journeyVersion: 3, publicTitle: identity.title,
  publicSummary: 'Public özet', authorUserId: 'publisher', selectedCount: 8, replayReady: true,
  steps: Array.from({ length: 8 }, (_, i) => ({ stepIndex: i + 1, publicQuestion: `Public soru ${i + 1}?`,
    publicAnswer: `**Public cevap ${i + 1}**\n\n${'Uzun paragraf. '.repeat(120)}\n\n- Birinci madde\n- İkinci madde`, ezaSnapshot: null })),
})!;

beforeEach(() => {
  localStorage.clear(); clearAllFrozenReplayProgressForTests(); vi.clearAllMocks();
  mocks.create.mockResolvedValue({ ok: false });
});
function mount() { return render(<MirrorFrozenReplay artifact={artifact()} desktopIdentity={identity} desktopMetrics={<div data-testid="desktop-metrics">Metrikler</div>} />); }
function send() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Mesaj yaz' }), { target: { value: 'Kendi sorum' } });
  fireEvent.click(screen.getByTestId('saina-send-btn'));
}

describe('desktop shared chat adapter', () => {
  it.each([1, 4, 8])('submits only the completed %s-step public selection', async (count) => {
    mount();
    for (let i = 1; i <= count; i++) {
      fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
      await waitFor(() => expect(screen.getByText(`Public cevap ${i}`)).toBeInTheDocument());
    }
    send();
    await screen.findByRole('alert');
    expect(mocks.create).toHaveBeenCalledWith('shared-chat', { replaySelection: { slug: 'shared-chat', journeyVersion: 3, completedStepCount: count } });
  });
  it('replays 1, 3 and 8 public pairs with shared markdown bubbles, without personal calls', async () => {
    const { container } = mount();
    expect(screen.getByText('Public yayıncı')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-metrics')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mirror-frozen-replay-complete')).not.toBeInTheDocument();
    for (let i = 1; i <= 8; i++) {
      fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
      await waitFor(() => expect(screen.getByText(`Public cevap ${i}`)).toBeInTheDocument());
      if (i < 8) expect(screen.queryByTestId('mirror-frozen-replay-complete')).not.toBeInTheDocument();
      if (i === 1 || i === 3 || i === 8) {
        expect(container.querySelectorAll('.saina-msg-user')).toHaveLength(i);
        expect(container.querySelectorAll('.saina-msg-ai')).toHaveLength(i);
      }
    }
    const completion = screen.getByTestId('mirror-frozen-replay-complete');
    const root = screen.getByTestId('mirror-frozen-replay-thread');
    expect(root.contains(completion)).toBe(true);
    expect(root.contains(screen.getByTestId('mirror-frozen-replay-explore-another'))).toBe(true);
    expect(root.querySelector('.saina-message-list')!.compareDocumentPosition(completion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('yansi-chat-composer-lane').contains(completion)).toBe(false);
    expect(completion.closest('.saina-desktop-replay-action')).toBeNull();
    root.scrollTop = 0; fireEvent.scroll(root);
    expect(root.scrollTop).toBe(0);
    expect(root.contains(completion)).toBe(true);
    expect(screen.queryByTestId('mirror-frozen-replay-next-question')).not.toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(16);
    expect(screen.getByRole('textbox', { name: 'Mesaj yaz' })).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled();
  });

  it('preserves draft after failure and retries through the existing personal chain', async () => {
    mount(); send();
    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Mesaj yaz' })).toHaveValue('Kendi sorum');
    const session = { mirrorSlug: 'shared-chat', guestToken: 'guest' };
    mocks.create.mockResolvedValue({ ok: true, session }); mocks.start.mockReturnValue({ chatId: 'personal-id' });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/standalone?chat=personal-id&mirrorReply=1'));
    expect(mocks.start).toHaveBeenCalledWith({ session, firstUserMessage: 'Kendi sorum' });
    expect(screen.getByRole('textbox', { name: 'Mesaj yaz' })).toHaveValue('Kendi sorum');
    expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute('data-step-index', '1');
  });

  it('blocks duplicate submission and cancels handoff after leaving the experience', async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = mount(); send();
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    unmount(); resolve({ ok: true, session: { mirrorSlug: 'shared-chat', guestToken: 'guest' } });
    await Promise.resolve(); await Promise.resolve();
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });

  it('owns scroll on the message element and uses instant scrolling for reduced motion', async () => {
    mount();
    const root = screen.getByTestId('mirror-frozen-replay-thread');
    const scrollTo = vi.fn(); root.scrollTo = scrollTo;
    Object.defineProperty(root, 'scrollHeight', { configurable: true, value: 1800 });
    Object.defineProperty(root, 'clientHeight', { configurable: true, value: 400 });
    root.scrollTop = 0; fireEvent.scroll(root);
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: 'auto' }));
    expect(root).toHaveClass('saina-standalone-messages-scroll');
    expect(root.contains(screen.getByTestId('saina-composer'))).toBe(false);
    expect(root.contains(screen.getByTestId('yansi-title-block'))).toBe(false);
  });

  it('keeps the legacy mobile replay without the desktop composer', () => {
    render(<MirrorFrozenReplay artifact={artifact()} />);
    expect(screen.queryByTestId('yansi-desktop-experience')).not.toBeInTheDocument();
    expect(screen.queryByTestId('saina-composer')).not.toBeInTheDocument();
    expect(screen.getByTestId('mirror-frozen-replay-continue')).toHaveAttribute('href', '/m/shared-chat/sohbet');
  });

  it('guards double taps during reveal and stops following when the reader scrolls up', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ ...original(query), matches: false }));
    try {
      const { container, unmount } = mount();
      const root = screen.getByTestId('mirror-frozen-replay-thread');
      root.scrollTo = vi.fn();
      Object.defineProperty(root, 'scrollHeight', { configurable: true, value: 1800 });
      Object.defineProperty(root, 'clientHeight', { configurable: true, value: 400 });
      const button = screen.getByTestId('mirror-frozen-replay-next-question');
      act(() => { button.click(); button.click(); });
      expect(container.querySelectorAll('.saina-msg-user')).toHaveLength(1);
      await waitFor(() => expect(root.scrollTo).toHaveBeenCalled());
      root.scrollTop = 0; fireEvent.scroll(root);
      await act(async () => { await new Promise((done) => setTimeout(done, 80)); });
      expect(root.scrollTop).toBe(0);
      expect(screen.getByTestId('frozen-answer-reveal')).toHaveAttribute('data-reveal-complete', 'false');
      unmount();
    } finally { window.matchMedia = original; }
  });
});
