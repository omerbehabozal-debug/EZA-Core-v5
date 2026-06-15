'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import {
  SAINA_BRAND,
  SAINA_CHIPS_TOGGLE,
  SAINA_COMPOSER_PLACEHOLDER,
  SAINA_QUICK_CHIPS,
} from '@/lib/eza/sainaCopy';
import { MOCK_SAINA_CONVERSATIONS } from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from '@/components/saina/SainaCommandPalette';
import SainaGeometricMark from './SainaGeometricMark';
import SainaHeroScene from './SainaHeroScene';
import SainaPageTopBar from './SainaPageTopBar';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';

export type SainaMockMessage = {
  role: 'user' | 'ai';
  label: string;
  initial: string | null;
  text: string;
};

export const SAINA_SAMPLE_MESSAGES: SainaMockMessage[] = [
  {
    role: 'user',
    label: 'SEN',
    initial: 'E',
    text: 'SAINA, bugün ne üzerine düşünelim?',
  },
  {
    role: 'ai',
    label: 'SAINA',
    initial: null,
    text: 'Merhaba Ece, Bugün zihnini, fikrini veya merak ettiğin herhangi bir konuyu konuşabiliriz. Ben seni dinlemek ve anlamlandırmana eşlik etmek için buradayım.',
  },
  {
    role: 'user',
    label: 'SEN',
    initial: 'E',
    text: 'İpek Yolu üzerine konuşmak istiyorum.',
  },
];

type SainaConversationMainProps = {
  /** Test/demo: render sample thread on mount */
  initialShowSampleMessages?: boolean;
};

export default function SainaConversationMain({
  initialShowSampleMessages = false,
}: SainaConversationMainProps) {
  const [chipsOpen, setChipsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [messages, setMessages] = useState<SainaMockMessage[]>(
    initialShowSampleMessages ? SAINA_SAMPLE_MESSAGES : []
  );

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  const hasMessages = messages.length > 0;

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        label: 'SEN',
        initial: 'E',
        text,
      },
    ]);
    setDraft('');
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="saina-main">
      <SainaPageTopBar onOpenCommandPalette={openCommandPalette} />
      <div className="saina-main-body" data-testid="saina-main-body">
        <SainaHeroScene />

        <div className="saina-chat-column" data-testid="saina-chat-column">
          {hasMessages ? (
            <div className="saina-chat-float">
              <div className="saina-chat-card" data-testid="saina-chat-card">
                <div className="saina-chat-messages">
                  {messages.map((msg, i) => {
                    const isFirstAi =
                      msg.role === 'ai' &&
                      !messages.slice(0, i).some((prior) => prior.role === 'ai');

                    return (
                      <div
                        key={i}
                        className={`saina-msg-row saina-msg-row--${msg.role === 'user' ? 'user' : 'ai'}`}
                        data-testid={`saina-msg-${msg.role}`}
                      >
                        <div className="saina-msg-content">
                          {isFirstAi ? (
                            <div className="saina-msg-ai-header">
                              <SainaGeometricMark
                                size={18}
                                variant="gold"
                                className="saina-msg-ai-mark"
                              />
                              <span className="saina-msg-ai-title">{SAINA_BRAND}</span>
                            </div>
                          ) : null}
                          <div
                            className={
                              msg.role === 'user'
                                ? 'saina-msg-user saina-msg-user--standalone'
                                : 'saina-msg-ai'
                            }
                          >
                            <SainaMessageBody message={msg.text} role={msg.role} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <div className="saina-composer-zone">
            <div className="saina-composer-inner">
              <div className="saina-composer-box">
                <SainaGeometricMark size={20} variant="gold" />
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={SAINA_COMPOSER_PLACEHOLDER}
                  className="saina-composer-input"
                  aria-label="Mesaj yaz"
                />
                <button type="button" className="saina-icon-btn saina-icon-btn--composer" aria-label="Sesli giriş">
                  <Mic size={16} />
                </button>
                <button
                  type="button"
                  className="saina-send-btn"
                  aria-label="Gönder"
                  data-testid="saina-send-btn"
                  onClick={handleSend}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
              {!chipsOpen ? (
                <button
                  type="button"
                  className="saina-chips-toggle"
                  data-testid="saina-chips-toggle"
                  onClick={() => setChipsOpen(true)}
                >
                  {SAINA_CHIPS_TOGGLE}
                </button>
              ) : (
                <div className="saina-chips-row saina-chips-row--open">
                  {SAINA_QUICK_CHIPS.map((chip) => (
                    <button key={chip} type="button" className="saina-chip" disabled>
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SainaCommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        conversations={MOCK_SAINA_CONVERSATIONS}
      />
    </div>
  );
}
