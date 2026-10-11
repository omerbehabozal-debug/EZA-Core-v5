import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMirrorPendingReply, type MirrorPendingDelivery } from '@/components/mirror-landing/useMirrorPendingReply';
import { getChatArchive, upsertChatArchive, type ArchivedChat } from '@/lib/standaloneChatArchive';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const text = 'peki uykusuzluk ne yapar';
function seed(id = 'personal'): ArchivedChat {
  const entry: ArchivedChat = { id, title: text, preview: text, savedAt: new Date().toISOString(), messageCount: 0, messages: [],
    mirrorOrigin: { startedFromMirrorId: 'source', parentMirrorId: 'source', rootMirrorId: 'source', seedTopic: '', seedMood: '', seedCategory: '', isGuestSession: true, autoReplyPending: true, pendingUserMessage: text } };
  upsertChatArchive(entry); return entry;
}
function Harness({ chatId = 'personal', route = 'personal', ready = true, authReady = true, busy = false, send, delivered, failed }: {
  chatId?: string; route?: string; ready?: boolean; authReady?: boolean; busy?: boolean;
  send: Parameters<typeof useMirrorPendingReply>[0]['send']; delivered: (id: string) => void; failed: () => void;
}) {
  const pending = useMirrorPendingReply({ chatId, routeChatId: route, ready, authReady, busy, send, onDelivered: delivered, onFailed: failed });
  return <button disabled={!pending.canRetry} onClick={pending.retry}>Retry</button>;
}
beforeEach(() => { localStorage.clear(); });
describe('real pending handoff hook (transport mocked)', () => {
  it.each([false, true])('waits for controller/auth readiness, preserving question until success (authenticated=%s)', async (authenticated) => {
    seed(); let complete!: (value: boolean) => void;
    const send = vi.fn((_text: string, _delivery: MirrorPendingDelivery) => new Promise<boolean>((r) => { complete = r; })); const delivered = vi.fn(); const failed = vi.fn();
    const ui = render(<Harness ready={false} authReady={!authenticated} send={send} delivered={delivered} failed={failed} />);
    expect(send).not.toHaveBeenCalled(); expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBe(text);
    ui.rerender(<Harness send={send} delivered={delivered} failed={failed} />);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toBe(text);
    expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(true);
    expect(delivered).not.toHaveBeenCalled();
    await act(async () => complete(true));
    expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(false);
    expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBeUndefined();
    expect(delivered).toHaveBeenCalledTimes(1);
  });
  it('joins one in-flight send across Strict Mode/remount, and retries failure with stable IDs', async () => {
    seed(); let complete!: (value: boolean) => void;
    const send = vi.fn((_text: string, _delivery: MirrorPendingDelivery) => new Promise<boolean>((r) => { complete = r; })); const delivered = vi.fn(); const failed = vi.fn();
    const element = <StrictMode><Harness send={send} delivered={delivered} failed={failed} /></StrictMode>;
    let ui = render(element); await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const first = send.mock.calls[0]; ui.unmount(); ui = render(element);
    await act(async () => complete(false));
    expect(send).toHaveBeenCalledTimes(1); expect(delivered).not.toHaveBeenCalled();
    expect(getChatArchive('personal')?.mirrorOrigin?.pendingUserMessage).toBe(text);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]).toEqual(first);
    await act(async () => complete(true)); expect(delivered).toHaveBeenCalledTimes(1);
  });
  it('does not consume a stale pending question after switching chat or source/version', async () => {
    seed(); const other = seed('other'); let complete!: (value: boolean) => void;
    const send = vi.fn((_text: string, _delivery: MirrorPendingDelivery) => new Promise<boolean>((r) => { complete = r; })); const delivered = vi.fn(); const failed = vi.fn();
    const ui = render(<Harness send={send} delivered={delivered} failed={failed} />);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    ui.rerender(<Harness chatId="other" route="personal" send={send} delivered={delivered} failed={failed} />);
    await act(async () => complete(true)); expect(delivered).not.toHaveBeenCalled(); expect(send).toHaveBeenCalledTimes(1);
    expect(getChatArchive('personal')?.mirrorOrigin?.autoReplyPending).toBe(true);
    expect(getChatArchive(other.id)?.mirrorOrigin?.autoReplyPending).toBe(true);
  });
  it('recovers acknowledged stable IDs after refresh without a duplicate transport', async () => {
    const archive = seed(); archive.mirrorOrigin!.pendingUserMessageId = 'u'; archive.mirrorOrigin!.pendingAssistantMessageId = 'a';
    archive.messages = [{ id: 'u', text, isUser: true }, { id: 'a', text: 'Yanıt', isUser: false }]; upsertChatArchive(archive);
    const send = vi.fn(); const delivered = vi.fn();
    render(<Harness send={send} delivered={delivered} failed={vi.fn()} />);
    await waitFor(() => expect(delivered).toHaveBeenCalledTimes(1)); expect(send).not.toHaveBeenCalled();
  });
  it('wires normal send/stream/fallback persistence with stable turn IDs and no eager consumption', () => {
    const src = readFileSync(resolve('components/standalone/StandaloneChatInner.tsx'), 'utf8');
    expect(src).toContain('send: handleSend'); expect(src).not.toContain('clearMirrorAutoReplyPending(');
    expect(src).toContain('pendingDelivery?.userMessageId'); expect(src).toContain('pendingDelivery?.assistantMessageId');
    expect(src).toContain("startStream('/api/standalone/stream'"); expect(src).toContain("}>('/api/standalone'");
    expect(src).toContain('saveStandaloneChat(resolvedChatId, toArchivedMessages(');
  });
});
