/**
 * InputBar Component - Apple iMessage Style Premium Input
 */

import { useState, FormEvent, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function InputBar({ onSend, isLoading, disabled = false }: InputBarProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = 44; // Minimum height in pixels
      const calculatedHeight = Math.max(minHeight, scrollHeight);
      const maxHeight = 120;
      textareaRef.current.style.height = `${Math.min(calculatedHeight, maxHeight)}px`;
    }
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    }
  };

  return (
    <div className={standaloneSkin.chromeBottom}>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  // Only send if message is not empty, not loading, and not disabled (limit not reached)
                  if (message.trim() && !isLoading && !disabled) {
                    onSend(message.trim());
                    setMessage('');
                    if (textareaRef.current) {
                      textareaRef.current.style.height = '48px';
                    }
                  }
                }
                // Shift + Enter allows new line (default behavior, no preventDefault)
              }}
              placeholder={disabled ? "Günlük limit doldu" : "Mesaj yaz…"}
              rows={1}
              disabled={disabled}
              className={standaloneSkin.input}
              style={{
                maxHeight: '120px',
                minHeight: '44px',
                lineHeight: '1.4',
                boxSizing: 'border-box',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim() || isLoading || disabled}
            className={standaloneSkin.sendBtn}
            aria-label="Send message"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
