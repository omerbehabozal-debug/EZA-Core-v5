'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { postSafeModeFeedback } from '@/api/safemode';
import { useOrganization } from '@/context/OrganizationContext';
import type { StandaloneFeedbackContext } from '@/lib/types';

const CHIPS = [
  { label: 'Doğru', type: 'CORRECT' },
  { label: 'Çok sert', type: 'TOO_STRICT' },
  { label: 'Çok yumuşak', type: 'TOO_SOFT' },
  { label: 'Yanlış kategori', type: 'WRONG_CATEGORY' },
] as const;

export interface StandaloneFeedbackChipsProps {
  context: StandaloneFeedbackContext;
  className?: string;
}

function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('eza_token'));
}

export default function StandaloneFeedbackChips({
  context,
  className,
}: StandaloneFeedbackChipsProps) {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const eventId = context.eventId;
  if (!eventId) return null;

  const authed = hasAuthToken();

  const handleClick = async (feedbackType: string) => {
    if (!authed || !eventId) return;
    setSubmitting(feedbackType);
    setMessage(null);
    try {
      await postSafeModeFeedback(
        {
          event_id: eventId,
          feedback_type: feedbackType,
          metric_name: 'standalone_response',
          original_label: context.originalLabel,
          original_score: context.originalScore,
        },
        currentOrganization?.id
      );
      setMessage('Teşekkürler');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-normal text-eza-text-muted transition-colors hover:bg-eza-surface-muted hover:text-eza-text-secondary touch-manipulation"
        aria-expanded={open}
      >
        <MessageSquarePlus className="h-3 w-3 shrink-0" aria-hidden />
        Geri bildirim
      </button>

      {open ? (
        <div className="flex flex-wrap gap-1">
          {CHIPS.map((chip) => (
            <button
              key={chip.type}
              type="button"
              disabled={!authed || submitting !== null}
              title={authed ? undefined : 'Giriş gerekir'}
              onClick={() => handleClick(chip.type)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                authed
                  ? 'border-standalone-border/80 bg-white text-standalone-text-secondary hover:border-standalone-primary/40 hover:text-standalone-primary'
                  : 'cursor-not-allowed border-eza-border/60 bg-eza-surface-muted text-eza-text-muted'
              )}
            >
              {submitting === chip.type ? '…' : chip.label}
            </button>
          ))}
          {message ? (
            <span className="w-full text-xs text-standalone-primary">{message}</span>
          ) : null}
          {!authed ? (
            <span className="w-full text-xs text-eza-text-muted">Platform girişi gerekir</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
