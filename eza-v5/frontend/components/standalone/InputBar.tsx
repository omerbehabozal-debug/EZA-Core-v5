/**
 * InputBar — sohbet kolonuna bağlı kompakt composer
 */

import { useState, FormEvent, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import AnalyzedModelSelect from './AnalyzedModelSelect';

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  isEmpty?: boolean;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
}

export default function InputBar({
  onSend,
  isLoading,
  disabled = false,
  isEmpty = false,
  analysisModelId,
  onAnalysisModelChange,
}: InputBarProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const h = Math.min(Math.max(40, textareaRef.current.scrollHeight), 100);
      textareaRef.current.style.height = `${h}px`;
    }
  }, [message]);

  const submit = (text: string) => {
    onSend(text);
    setMessage('');
    if (textareaRef.current) textareaRef.current.style.height = '40px';
  };

  return (
    <footer className={isEmpty ? standaloneSkin.composerDockEmpty : standaloneSkin.composerDock}>
      <div className={standaloneSkin.composerStack}>
        <AnalyzedModelSelect
          value={analysisModelId}
          onChange={onAnalysisModelChange}
          disabled={isLoading || disabled}
        />
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (message.trim() && !isLoading && !disabled) submit(message.trim());
          }}
          className={standaloneSkin.composerCard}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (message.trim() && !isLoading && !disabled) submit(message.trim());
              }
            }}
            placeholder={disabled ? 'Günlük limit doldu' : 'Mesaj yazın…'}
            rows={1}
            disabled={disabled}
            className={standaloneSkin.input}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading || disabled}
            className={standaloneSkin.sendBtn}
            aria-label="Gönder"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </footer>
  );
}
