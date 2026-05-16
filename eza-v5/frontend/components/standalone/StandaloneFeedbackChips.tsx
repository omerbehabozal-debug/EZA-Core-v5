'use client';

import { useState } from 'react';
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
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const eventId = context.eventId;
  if (!eventId) {
    return null;
  }

  const authed = hasAuthToken();
  const disabledReason = authed
    ? undefined
    : 'Geri bildirim için giriş yapın (platform login).';

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
      setMessage('Teşekkürler — kalibrasyon sinyali kaydedildi.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className={cn('mt-1.5', className)}>
      <p className="text-[10px] text-eza-text-muted mb-1">Kalibrasyon (isteğe bağlı)</p>
      <div className="flex flex-wrap gap-1">
        {CHIPS.map((chip) => (
          <button
            key={chip.type}
            type="button"
            disabled={!authed || submitting !== null}
            title={disabledReason}
            onClick={() => handleClick(chip.type)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              authed
                ? 'border-eza-border bg-eza-surface text-eza-accent hover:bg-eza-accent-muted'
                : 'border-eza-border bg-eza-surface-muted text-eza-text-muted cursor-not-allowed'
            )}
          >
            {submitting === chip.type ? '…' : chip.label}
          </button>
        ))}
      </div>
      {message ? <p className="mt-1 text-[10px] text-eza-accent">{message}</p> : null}
      {!authed ? (
        <p className="mt-0.5 text-[10px] text-eza-text-muted">{disabledReason}</p>
      ) : null}
    </div>
  );
}
