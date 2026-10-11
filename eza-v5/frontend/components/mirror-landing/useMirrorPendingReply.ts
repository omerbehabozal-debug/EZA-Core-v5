"use client";

import { useEffect, useRef, useState } from 'react';
import { clearMirrorAutoReplyPending, getChatArchive, upsertChatArchive } from '@/lib/standaloneChatArchive';
import { generateMessageClientId } from '@/lib/eza/clientStableIds';

export type MirrorPendingDelivery = { chatId: string; userMessageId: string; assistantMessageId: string; sourceSlug: string; journeyVersion?: number };
// Strict Mode / same-tab remounts join the existing send, never launch it twice.
const inFlight = new Map<string, Promise<boolean | void>>();

export function useMirrorPendingReply(input: {
  chatId: string | null; routeChatId: string | null; ready: boolean; authReady: boolean; busy: boolean;
  send: (text: string, delivery: MirrorPendingDelivery) => Promise<boolean | void>;
  onDelivered: (chatId: string) => void; onFailed: () => void;
}) {
  const latest = useRef(input); latest.current = input;
  const mounted = useRef(true);
  const attempted = useRef<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [failedChat, setFailedChat] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const { chatId, routeChatId, ready, authReady, busy } = input;
    if (!ready || !authReady || busy || !chatId || chatId !== routeChatId) return;
    const archive = getChatArchive(chatId);
    const origin = archive?.mirrorOrigin;
    const text = origin?.pendingUserMessage?.trim();
    if (!archive || !origin?.autoReplyPending || !text) return;
    const source = archive.publicReplayContext;
    if (archive.publicReplayUnavailable || (source && source.slug !== origin.startedFromMirrorId)) return;
    const key = `${chatId}:${origin.startedFromMirrorId}:${source?.journeyVersion ?? 0}`;
    if (attempted.current === key) return;
    attempted.current = key;
    const userMessageId = origin.pendingUserMessageId || generateMessageClientId('user');
    const assistantMessageId = origin.pendingAssistantMessageId || generateMessageClientId('eza');
    upsertChatArchive({ ...archive, mirrorOrigin: { ...origin, pendingUserMessageId: userMessageId, pendingAssistantMessageId: assistantMessageId } });
    const stillCurrent = () => {
      const now = latest.current;
      const current = getChatArchive(chatId);
      return mounted.current && now.authReady && now.chatId === chatId && now.routeChatId === chatId &&
        current?.mirrorOrigin?.pendingUserMessageId === userMessageId &&
        current.mirrorOrigin.startedFromMirrorId === origin.startedFromMirrorId &&
        current.publicReplayContext?.journeyVersion === source?.journeyVersion;
    };
    const finish = (success: boolean | void) => {
      if (!stillCurrent()) return;
      if (success === true) {
        clearMirrorAutoReplyPending(chatId);
        setFailedChat(null);
        latest.current.onDelivered(chatId);
      } else {
        setFailedChat(chatId);
        latest.current.onFailed();
      }
    };
    // Server hydrate may already contain the acknowledged turn after a refresh.
    if (archive.messages.some((m) => m.id === userMessageId && m.isUser) &&
        archive.messages.some((m) => m.id === assistantMessageId && !m.isUser && m.text.trim())) {
      finish(true); return;
    }
    let request = inFlight.get(key);
    if (!request) {
      request = Promise.resolve().then(() => {
        if (!stillCurrent()) return false;
        return latest.current.send(text, { chatId, userMessageId, assistantMessageId, sourceSlug: origin.startedFromMirrorId, journeyVersion: source?.journeyVersion });
      });
      inFlight.set(key, request);
      void request.finally(() => { if (inFlight.get(key) === request) inFlight.delete(key); }).catch(() => {});
    }
    void request.then(finish, () => finish(false));
  }, [input.chatId, input.routeChatId, input.ready, input.authReady, input.busy, retryTick]);
  return {
    canRetry: failedChat !== null && failedChat === input.chatId,
    retry: () => { attempted.current = null; setFailedChat(null); setRetryTick((n) => n + 1); },
  };
}
