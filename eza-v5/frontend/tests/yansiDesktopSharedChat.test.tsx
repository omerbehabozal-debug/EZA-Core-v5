import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import FrozenAnswerReveal from '@/components/mirror-landing/FrozenAnswerReveal';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { returnToYansiReelDepth } from '@/lib/eza/mirror-network/yansiPublicDepth';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';

const mocks = vi.hoisted(() => ({ create: vi.fn(), start: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({ createMirrorSohbetSession: mocks.create }));
vi.mock('@/lib/eza/mirror-network/mirrorGuestConversation', () => ({ startMirrorGuestChat: mocks.start, MIRROR_GUEST_CHAT_REPLY_PARAM: 'mirrorReply' }));
vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({ trackSeedStart: vi.fn(), trackGuestConversationStarted: vi.fn() }));
vi.mock('@/lib/eza/mirror-network/yansiPublicDepth', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/eza/mirror-network/yansiPublicDepth')>(),
  returnToYansiReelDepth: vi.fn(),
}));

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
  it.each([false, true])('keeps the completed CTA native, focusable and on existing navigation (callback=%s)', async (withCallback) => {
    const publicArtifact = artifact();
    publicArtifact.steps = publicArtifact.steps.slice(0, 1);
    publicArtifact.selectedCount = 1;
    const navigate = vi.fn();
    render(<MirrorFrozenReplay artifact={publicArtifact} desktopIdentity={identity}
      onExploreAnotherCuriosity={withCallback ? navigate : undefined} />);
    expect(screen.queryByTestId('mirror-frozen-replay-explore-another')).toBeNull();
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    const cta = await screen.findByRole('button', { name: 'Başka bir merak keşfet' });
    expect(cta).toHaveAttribute('type', 'button');
    expect(cta.tabIndex).toBe(0);
    expect(cta.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('mirror-frozen-replay-thread').contains(cta)).toBe(true);
    expect(screen.getByTestId('yansi-chat-composer-lane').contains(cta)).toBe(false);
    cta.focus();
    expect(cta).toHaveFocus();
    fireEvent.mouseOver(cta);
    expect(navigate).not.toHaveBeenCalled();
    expect(returnToYansiReelDepth).not.toHaveBeenCalled();
    // Native keyboard activation dispatches a click with detail=0.
    fireEvent.click(cta, { detail: 0 });
    if (withCallback) {
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(returnToYansiReelDepth).not.toHaveBeenCalled();
    } else {
      expect(returnToYansiReelDepth).toHaveBeenCalledTimes(1);
      expect(returnToYansiReelDepth).toHaveBeenCalledWith({ reelHref: expect.stringContaining('/m/shared-chat') });
    }
  });

  it('scopes CTA hover/focus/active styling to desktop completion and honors reduced motion', () => {
    const css = postcss.parse(readFileSync(resolve(process.cwd(), 'styles/yansi-reel-responsive.css'), 'utf8'));
    const selector = '.yansi-desktop-experience .yansi-replay-completion .yansi-chat-end-cta-secondary';
    const rules: import('postcss').Rule[] = [];
    css.walkRules((rule) => { if (rule.selector.includes(selector)) rules.push(rule); });
    const base = rules.find((rule) => rule.selector === selector)!;
    const value = (rule: import('postcss').Rule, property: string) => {
      let result: string | undefined;
      rule.walkDecls(property, (decl) => { result = decl.value; });
      return result;
    };
    expect(base.parent).toMatchObject({ name: 'media', params: '(min-width: 900px)' });
    expect(value(base, 'transition')).toContain('180ms');
    expect(value(base, 'position')).toBeUndefined();
    const hover = rules.find((rule) => rule.selector.includes(':hover'))!;
    expect(hover.selector).toContain(':focus-visible');
    expect(value(hover, 'background')).toBe('#d8b77b');
    expect(value(hover, 'color')).toBe('#211b12');
    const focus = rules.find((rule) => rule.selector === `${selector}:focus-visible`)!;
    expect(value(focus, 'outline')).toContain('2px');
    const active = rules.filter((rule) => rule.selector === `${selector}:active`);
    expect(value(active[0], 'transform')).toBe('translateY(1px)');
    expect(active[1].parent).toMatchObject({ params: '(prefers-reduced-motion: reduce)' });
    expect(value(active[1], 'transform')).toBe('none');
    expect(css.toString()).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.yansi-chat-end-cta-secondary[\s\S]*transition: none !important/);
  });
  it('keeps reveal prefixes and the completed answer on the same markdown renderer', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ ...original(query), matches: false }));
    const answer = '# Başlık\n\nİlk paragraf.\n\n1. İlk\n2. İkinci\n   - İç madde\n\nSon paragraf.';
    const prefix = answer.slice(0, 28);
    try {
      const { unmount } = render(<>
        <div data-testid="normal-prefix"><SainaMessageBody message={prefix} role="ai" /></div>
        <div data-testid="normal-complete"><SainaMessageBody message={answer} role="ai" /></div>
        <FrozenAnswerReveal text={answer} charsPerTick={28} tickMs={100} onComplete={() => {}}
          renderText={(text) => <SainaMessageBody message={text} role="ai" />} />
      </>);
      const body = () => screen.getByTestId('frozen-answer-reveal').querySelector('.saina-msg-prose')!.outerHTML;
      await waitFor(() => expect(body()).toBe(screen.getByTestId('normal-prefix').querySelector('.saina-msg-prose')!.outerHTML));
      expect(screen.getByTestId('frozen-answer-reveal')).toHaveAttribute('data-reveal-complete', 'false');
      await waitFor(() => expect(screen.getByTestId('frozen-answer-reveal')).toHaveAttribute('data-reveal-complete', 'true'));
      expect(body()).toBe(screen.getByTestId('normal-complete').querySelector('.saina-msg-prose')!.outerHTML);
      unmount();
    } finally { window.matchMedia = original; }
  });
  it('does not invent paragraphs or lists in legacy flattened answers', () => {
    const answer = 'Başlık Eski paragraf. 1. Birinci 2. İkinci - madde';
    const { container } = render(<SainaMessageBody message={answer} role="ai" />);
    expect(container.querySelectorAll('.saina-markdown > p')).toHaveLength(1);
    expect(container.querySelector('ol, ul, h3, h4')).toBeNull();
    expect(container).toHaveTextContent(answer);
  });
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
        expect(container.querySelectorAll('.saina-message-list:not(.yansi-replay-completion) .saina-msg-ai')).toHaveLength(i);
      }
    }
    const completion = screen.getByTestId('mirror-frozen-replay-complete');
    const root = screen.getByTestId('mirror-frozen-replay-thread');
    expect(root.contains(completion)).toBe(true);
    expect(root.contains(screen.getByTestId('mirror-frozen-replay-explore-another'))).toBe(true);
    expect(root.querySelector('.saina-message-list')!.compareDocumentPosition(completion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('yansi-chat-composer-lane').contains(completion)).toBe(false);
    expect(completion.closest('.saina-desktop-replay-action')).toBeNull();
    expect(completion.closest('.saina-msg-row')).toHaveClass('saina-msg-row--ai');
    expect(completion.parentElement).toHaveClass('saina-msg-content');
    expect(completion.closest('.yansi-replay-completion')).toHaveClass('saina-message-list');
    root.scrollTop = 0; fireEvent.scroll(root);
    expect(root.scrollTop).toBe(0);
    expect(root.contains(completion)).toBe(true);
    expect(screen.queryByTestId('mirror-frozen-replay-next-question')).not.toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(16);
    expect(screen.getByRole('textbox', { name: 'Mesaj yaz' })).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled();
  });

  it('uses the identical normal-chat markdown tree for public replay without rewriting text', async () => {
    const answer = '# Başlık\r\n\r\nUzun **kalın** paragraf.\r\n\r\n## Alt başlık\r\n\r\n1. İlk\r\n2. İkinci\r\n   - İç madde\r\n\r\n- Bir\r\n- İki\r\n\r\nSatır bir  \r\nSatır iki';
    const publicArtifact = artifact();
    publicArtifact.steps[0].publicAnswer = answer;
    const { container } = render(<><div data-testid="normal-answer"><SainaMessageBody message={answer} role="ai" /></div>
      <MirrorFrozenReplay artifact={publicArtifact} desktopIdentity={identity} /></>);
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(screen.queryByTestId('frozen-answer-reveal')).not.toBeInTheDocument());
    const normal = screen.getByTestId('normal-answer').querySelector('.saina-msg-prose')!;
    const replay = container.querySelector('[data-testid="mirror-frozen-replay-thread"] .saina-msg-ai .saina-msg-prose')!;
    expect(replay.outerHTML).toBe(normal.outerHTML);
    expect(replay.querySelectorAll('ol > li')).toHaveLength(2);
    expect(replay.querySelector('ol ul li')).toHaveTextContent('İç madde');
    expect(replay.querySelector('br')).toBeTruthy();
    expect(replay.querySelector('.saina-msg-prose-heading')).toHaveTextContent('Başlık');
    expect(publicArtifact.steps[0].publicAnswer).toBe(answer);
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
