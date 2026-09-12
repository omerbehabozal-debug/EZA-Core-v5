/**
 * Transport failures must never become assistant chat content / autosave.
 * Mounted harness mirrors StandaloneChatInner catch + autosave filtering.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import {
  CHAT_TRANSPORT_ERROR_COPY,
  isInfrastructureChatSendError,
  resolveChatSendFailureDisplay,
} from '@/lib/eza/chatSendFailureDisplay';
import { toArchivedMessages } from '@/lib/standaloneChatSession';

const chatInnerSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
  'utf8'
);

type Msg = { id: string; text: string; isUser: boolean };

/**
 * Mirrors handleSend outer catch: stream fail → fallback INVALID_RESPONSE →
 * transient error (not Message). Subsequent success clears error.
 */
function ChatSendTransportErrorHarness() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'user-1', text: 'test', isUser: true },
  ]);
  const [sendRequestError, setSendRequestError] = useState<string | null>(null);
  const [archivedSnapshot, setArchivedSnapshot] = useState<
    ReturnType<typeof toArchivedMessages>
  >([]);

  const persist = (next: Msg[]) => {
    setArchivedSnapshot(toArchivedMessages(next));
  };

  const simulateTransportFailure = () => {
    const err = Object.assign(new Error('Server returned non-JSON response'), {
      code: 'INVALID_RESPONSE',
    });
    const display = resolveChatSendFailureDisplay(err, 'free');
    // Remove placeholder assistant (already absent in this harness).
    if (display.mode === 'domain_message') {
      const next = [
        ...messages,
        { id: `limit-${Date.now()}`, text: display.text, isUser: false },
      ];
      setMessages(next);
      persist(next);
      return;
    }
    setSendRequestError(display.text);
    persist(messages);
  };

  const simulateSuccessfulSend = () => {
    setSendRequestError(null);
    const next = [
      ...messages,
      { id: 'user-2', text: 'ikinci', isUser: true },
      { id: 'eza-2', text: 'Merhaba, yardımcı olayım.', isUser: false },
    ];
    setMessages(next);
    persist(next);
  };

  const hydrateFromServer = () => {
    setSendRequestError(null);
    const next = [
      { id: 'user-1', text: 'test', isUser: true },
      {
        id: 'srv-assistant-1',
        text: 'Sunucuda kaydedilmiş asistan yanıtı',
        isUser: false,
      },
    ];
    setMessages(next);
    persist(next);
  };

  return (
    <div>
      <ul data-testid="messages">
        {messages.map((m) => (
          <li key={m.id} data-testid={`msg-${m.id}`} data-role={m.isUser ? 'user' : 'assistant'}>
            {m.text}
          </li>
        ))}
      </ul>
      {sendRequestError ? (
        <div role="alert" data-testid="chat-send-request-error">
          {sendRequestError}
        </div>
      ) : null}
      <pre data-testid="autosaved">{JSON.stringify(archivedSnapshot)}</pre>
      <button type="button" data-testid="fail-transport" onClick={simulateTransportFailure}>
        Fail transport
      </button>
      <button type="button" data-testid="send-ok" onClick={simulateSuccessfulSend}>
        Send ok
      </button>
      <button type="button" data-testid="hydrate-server" onClick={hydrateFromServer}>
        Hydrate
      </button>
    </div>
  );
}

describe('resolveChatSendFailureDisplay', () => {
  it('maps INVALID_RESPONSE / non-JSON to transient friendly copy', () => {
    const err = Object.assign(new Error('Server returned non-JSON response'), {
      code: 'INVALID_RESPONSE',
    });
    expect(isInfrastructureChatSendError(err)).toBe(true);
    expect(resolveChatSendFailureDisplay(err, 'free')).toEqual({
      mode: 'transient',
      text: CHAT_TRANSPORT_ERROR_COPY,
    });
  });

  it('keeps quota as domain_message', () => {
    const err = Object.assign(new Error('limit'), {
      quotaDetail: { reason: 'daily_message_limit_reached', currentTier: 'free' },
    });
    const display = resolveChatSendFailureDisplay(err, 'free');
    expect(display.mode).toBe('domain_message');
  });
});

describe('Chat send transport error — mounted', () => {
  it('A) INVALID_RESPONSE → no assistant with technical text; transient UI; not autosaved', () => {
    render(<ChatSendTransportErrorHarness />);
    fireEvent.click(screen.getByTestId('fail-transport'));

    expect(screen.queryByText('Server returned non-JSON response')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-send-request-error')).toHaveTextContent(
      CHAT_TRANSPORT_ERROR_COPY
    );

    const assistantTexts = screen
      .getAllByTestId(/^msg-/)
      .filter((el) => el.getAttribute('data-role') === 'assistant')
      .map((el) => el.textContent);
    expect(assistantTexts).not.toContain('Server returned non-JSON response');
    expect(assistantTexts).not.toContain(CHAT_TRANSPORT_ERROR_COPY);

    const autosaved = JSON.parse(screen.getByTestId('autosaved').textContent || '[]') as Msg[];
    expect(autosaved.some((m) => m.text.includes('Server returned non-JSON'))).toBe(false);
    expect(autosaved.some((m) => m.text === CHAT_TRANSPORT_ERROR_COPY)).toBe(false);
    expect(autosaved.some((m) => m.isUser && m.text === 'test')).toBe(true);
  });

  it('B) subsequent successful send clears transient error', async () => {
    render(<ChatSendTransportErrorHarness />);
    fireEvent.click(screen.getByTestId('fail-transport'));
    expect(screen.getByTestId('chat-send-request-error')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('send-ok'));
    await waitFor(() => {
      expect(screen.queryByTestId('chat-send-request-error')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Merhaba, yardımcı olayım.')).toBeInTheDocument();
  });

  it('C) hydrate with server-persisted assistant after transport failure', () => {
    render(<ChatSendTransportErrorHarness />);
    fireEvent.click(screen.getByTestId('fail-transport'));
    fireEvent.click(screen.getByTestId('hydrate-server'));

    expect(screen.queryByTestId('chat-send-request-error')).not.toBeInTheDocument();
    expect(screen.getByText('Sunucuda kaydedilmiş asistan yanıtı')).toBeInTheDocument();
    expect(screen.queryByText('Server returned non-JSON response')).not.toBeInTheDocument();
  });

  it('D) ChatInner wires transient sendRequestError (no error- Message append)', () => {
    expect(chatInnerSrc).toContain('sendRequestError');
    expect(chatInnerSrc).toContain('resolveChatSendFailureDisplay');
    expect(chatInnerSrc).toContain('chat-send-request-error');
    expect(chatInnerSrc).toContain('setSendRequestError(null)');
    // Old path must not append raw error.message as assistant Message.
    expect(chatInnerSrc).not.toMatch(
      /const errorMessage:\s*Message\s*=\s*\{[\s\S]*?id:\s*`error-\$\{Date\.now\(\)\}`/
    );
  });
});

describe('happy-path SSE wiring unchanged', () => {
  it('still starts /api/standalone/stream via useStreamResponse', () => {
    expect(chatInnerSrc).toContain("startStream('/api/standalone/stream'");
    expect(chatInnerSrc).toContain('useStreamResponse');
    const streamSrc = readFileSync(join(process.cwd(), 'hooks/useStreamResponse.ts'), 'utf8');
    expect(streamSrc).toContain('text/event-stream');
  });
});
