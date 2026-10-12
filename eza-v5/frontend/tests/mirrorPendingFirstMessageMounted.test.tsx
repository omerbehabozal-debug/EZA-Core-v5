import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: { isAuthReady: true, isAuthenticated: false, user: null as null | { user_id: string } },
  router: { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }, params: new URLSearchParams('chat=personal&mirrorReply=1'),
  stream: vi.fn(), reset: vi.fn(), refreshPlan: vi.fn(), refreshEntitlements: vi.fn(),
  fallback: vi.fn(), ensure: vi.fn(),
  summaries: [],
  plan: { isPlus: false, isLoading: false, source: 'default' },
  entitlements: { tier: 'guest', entitlements: { maxMessageChars: 2000, dailyMessageLimit: 10 }, usage: { dailyMessagesUsed: 0 } },
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.params, usePathname: () => '/standalone' }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/eza/plan/usePlan', () => ({ usePlan: () => ({ ...mocks.plan, refreshPlan: mocks.refreshPlan }) }));
vi.mock('@/lib/eza/plan/useAccountEntitlements', () => ({ useAccountEntitlements: () => ({ entitlements: mocks.entitlements, isLoading: false, refreshEntitlements: mocks.refreshEntitlements }) }));
vi.mock('@/hooks/useStreamResponse', () => ({ useStreamResponse: () => ({ startStream: mocks.stream, reset: mocks.reset }) }));
vi.mock('@/hooks/useAuthenticatedConversationBootstrap', () => ({ useAuthenticatedConversationBootstrap: () => ({ isServerBacked: mocks.auth.isAuthenticated, serverSummaries: mocks.summaries, userId: mocks.auth.user?.user_id ?? null }) }));
vi.mock('@/components/saina/SainaStandaloneShell', () => ({ default: (props: any) => <div>{props.messages}{props.composer}</div> }));
vi.mock('@/lib/apiClient', () => ({ apiClient: { post: mocks.fallback, get: vi.fn().mockResolvedValue({ ok: false }) } }));
vi.mock('@/lib/eza/serverConversationStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/eza/serverConversationStore')>();
  return { ...original, ensureServerConversation: mocks.ensure,
    fetchServerConversationDetail: async (id: string) => (await import('@/lib/standaloneChatArchive')).getChatArchive(id),
    persistServerConversationTitleIfNeeded: vi.fn().mockResolvedValue(undefined),
    subscribeServerConversations: () => () => {},
  };
});
import StandaloneChatInner from '@/components/standalone/StandaloneChatInner';
import { getChatArchive, upsertChatArchive } from '@/lib/standaloneChatArchive';
const text = 'peki uykusuzluk ne yapar';
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); mocks.auth.isAuthReady = true; mocks.auth.isAuthenticated = false; mocks.auth.user = null;
  mocks.params = new URLSearchParams('chat=personal&mirrorReply=1');
  mocks.ensure.mockResolvedValue({ id: 'server-personal', title: text });
  mocks.stream.mockImplementation(async (_url: string, _body: unknown, handlers: any) => {
    handlers.onToken('Uykusuzluk dikkatini etkileyebilir.');
    handlers.onDone({ assistant_answer: 'Uykusuzluk dikkatini etkileyebilir.' });
    return { text: 'Uykusuzluk dikkatini etkileyebilir.' };
  });
  mocks.fallback.mockResolvedValue({ ok: false, error: { message: 'network failed' } });
  upsertChatArchive({ id: 'personal', title: text, preview: text, savedAt: new Date().toISOString(), messageCount: 0, messages: [],
    mirrorOrigin: { startedFromMirrorId: 'source', parentMirrorId: 'source', rootMirrorId: 'source', seedTopic: '', seedCategory: '', seedMood: '', isGuestSession: true, autoReplyPending: true, pendingUserMessage: text },
    publicReplayContext: { slug: 'source', journeyVersion: 1, publicTitle: 'Public', authorUserId: 'publisher', completedStepCount: 3,
      steps: Array.from({ length: 3 }, (_, i) => ({ stepIndex: i + 1, publicQuestion: `Kaynak ${i + 1}?`, publicAnswer: `Cevap ${i + 1}` })) },
  });
});
describe('actual StandaloneChatInner first continuation send, mocked transport', () => {
  it.each([false, true])('creates a real first turn and starts the normal stream once (authenticated=%s)', async (auth) => {
    mocks.auth.isAuthenticated = auth; mocks.auth.user = auth ? { user_id: 'current-user' } : null;
    render(<StandaloneChatInner />);
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Uykusuzluk dikkatini etkileyebilir.')).toBeInTheDocument();
    const archive = getChatArchive('personal')!;
    expect(archive.messages.filter((m) => m.isUser && m.text === text)).toHaveLength(1);
    expect(archive.messages.filter((m) => !m.isUser && m.text.includes('Uykusuzluk'))).toHaveLength(1);
    expect(mocks.stream.mock.calls[0][1]).toMatchObject({ query: text, publicReplaySelection: { slug: 'source', journeyVersion: 1, completedStepCount: 3 } });
    expect(mocks.router.replace).toHaveBeenCalledWith('/standalone?chat=personal', { scroll: false });
    if (auth) {
      expect(mocks.ensure).toHaveBeenCalledTimes(1);
      expect(mocks.ensure.mock.invocationCallOrder[0]).toBeLessThan(mocks.stream.mock.invocationCallOrder[0]);
    }
  });
  it('waits for auth hydration and recovers pending even without the URL trigger', async () => {
    mocks.auth.isAuthReady = false; mocks.params = new URLSearchParams('chat=personal');
    const ui = render(<StandaloneChatInner />);
    await act(async () => {});
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBe(text);
    mocks.auth.isAuthReady = true; ui.rerender(<StandaloneChatInner />);
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
  });
  it('sends once in Strict Mode and keeps ordinary composer sends on the same pipeline', async () => {
    render(<StrictMode><StandaloneChatInner /></StrictMode>);
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Mesaj yaz' }), { target: { value: 'ikinci soru' } });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    expect(screen.getByText('ikinci soru')).toBeInTheDocument();
  });
  it('uses the normal non-stream fallback and durably records the first answer', async () => {
    mocks.stream.mockRejectedValueOnce(new Error('stream unavailable'));
    mocks.fallback.mockResolvedValueOnce({ ok: true, data: { assistant_answer: 'Fallback yanıtı' } });
    render(<StandaloneChatInner />);
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
    expect(mocks.fallback).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Fallback yanıtı')).toBeInTheDocument();
    expect(getChatArchive('personal')?.messages.filter((m) => m.isUser)).toHaveLength(1);
  });
  it('retains pending on failed stream + fallback, then retries with one user turn', async () => {
    mocks.stream.mockRejectedValueOnce(new Error('offline'));
    render(<StandaloneChatInner />);
    await waitFor(() => expect(mocks.fallback).toHaveBeenCalledTimes(1));
    expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBe(text);
    const retry = await screen.findByRole('button', { name: 'İlk mesajı tekrar gönder' });
    fireEvent.click(retry);
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    expect(getChatArchive('personal')?.messages.filter((m) => m.isUser && m.text === text)).toHaveLength(1);
  });
  it('sends trial session and stable turn IDs through the actual controller', async () => {
    const archive = getChatArchive('personal')!;
    upsertChatArchive({ ...archive, mirrorOrigin: { ...archive.mirrorOrigin!, guestTrialSessionId: 'trial-id' } });
    render(<StandaloneChatInner />);
    await waitFor(() => expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false));
    expect(mocks.stream.mock.calls[0][1]).toMatchObject({ guestTrialSessionId: 'trial-id',
      clientUserMessageId: expect.any(String), clientAssistantMessageId: expect.any(String) });
  });
  it.each([403, 429, 502])('preserves pending trial after HTTP %s without a second fallback request', async (status) => {
    const archive = getChatArchive('personal')!;
    upsertChatArchive({ ...archive, mirrorOrigin: { ...archive.mirrorOrigin!, guestTrialSessionId: 'trial-id' } });
    mocks.stream.mockRejectedValueOnce(Object.assign(new Error('Failed'), {status, reason: status === 403 ? 'guest_token_required' : undefined}));
    render(<StandaloneChatInner />);
    await screen.findByRole('button', { name: 'İlk mesajı tekrar gönder' });
    expect(mocks.fallback).not.toHaveBeenCalled();
    expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBe(text);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

});
