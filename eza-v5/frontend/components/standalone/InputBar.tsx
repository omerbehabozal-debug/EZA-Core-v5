/**
 * InputBar Component - Apple iMessage Style Premium Input
 */

import { useState, FormEvent, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

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
    <div className="sticky bottom-0 z-[100] bg-white backdrop-blur-xl border-t border-gray-200 safe-area-bottom shadow-lg">
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
              className="w-full px-3 py-2.5 sm:px-4 sm:py-3 pr-10 sm:pr-12 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none text-sm sm:text-[15px] text-gray-900 placeholder-gray-400 shadow-sm transition-all overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation hide-scrollbar"
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
            className="flex-shrink-0 h-[44px] w-[44px] sm:h-[48px] sm:w-[48px] rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center shadow-md text-white transition-all transform active:scale-95 touch-manipulation"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
