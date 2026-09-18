'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import { SAINA_COMPOSER_LIMIT_PLACEHOLDER, SAINA_COMPOSER_PLACEHOLDER } from '@/lib/eza/sainaCopy';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import SainaGeometricMark from './SainaGeometricMark';

export type SainaComposerProps = {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  /**
   * @deprecated Mobile Ayna discoverability uses the explicit composer-zone pill.
   * Kept for call-site compatibility; ignored.
   */
  onOpenAyna?: () => void;
};

export default function SainaComposer({
  onSend,
  isLoading,
  disabled = false,
  onOpenAyna: _onOpenAyna,
}: SainaComposerProps) {
  void _onOpenAyna;
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /** true = viewport ≥900px (desktop/tablet shell). false = mobile drawer shell. */
  const isCompactShell = useSainaCompactShell();

  useEffect(() => {
    // Desktop convenience only — never programmatically open the mobile keyboard.
    if (!isCompactShell) return;
    if (!isLoading && !disabled) {
      inputRef.current?.focus();
    }
  }, [isCompactShell, isLoading, disabled]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setMessage('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit(message);
    }
  };

  const placeholder = disabled ? SAINA_COMPOSER_LIMIT_PLACEHOLDER : SAINA_COMPOSER_PLACEHOLDER;

  return (
    <div className="saina-composer-inner" data-testid="saina-composer">
      <div className="saina-composer-box">
        {/* biligN mark is branding — discoverable Ayna lives on the mobile pill. */}
        <SainaGeometricMark size={20} variant="gold" />
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="saina-composer-input"
          aria-label="Mesaj yaz"
          disabled={disabled || isLoading}
        />
        <button
          type="button"
          className="saina-icon-btn saina-icon-btn--composer"
          aria-label="Sesli giriş"
          disabled
          tabIndex={-1}
        >
          <Mic size={16} />
        </button>
        <button
          type="button"
          className="saina-send-btn"
          aria-label="Gönder"
          data-testid="saina-send-btn"
          disabled={!message.trim() || isLoading || disabled}
          onClick={() => submit(message)}
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
