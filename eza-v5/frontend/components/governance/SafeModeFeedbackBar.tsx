'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { postSafeModeFeedback } from '@/api/safemode';
import { useOrganization } from '@/context/OrganizationContext';

const FEEDBACK_OPTIONS = [
  { label: 'Doğru', type: 'CORRECT' },
  { label: 'Çok sert', type: 'TOO_STRICT' },
  { label: 'Çok yumuşak', type: 'TOO_SOFT' },
  { label: 'Yanlış kategori', type: 'WRONG_CATEGORY' },
] as const;

export interface SafeModeFeedbackBarProps {
  eventId?: string | null;
  analysisId?: string | null;
  metricName?: string;
  className?: string;
}

export default function SafeModeFeedbackBar({
  eventId,
  analysisId,
  metricName,
  className,
}: SafeModeFeedbackBarProps) {
  const { currentOrganization } = useOrganization();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = Boolean(eventId || analysisId);
  const disabledReason = 'Feedback için kayıtlı event gerekli.';

  const handleFeedback = async (feedbackType: string) => {
    if (!canSubmit) return;
    setSubmitting(feedbackType);
    setMessage(null);
    try {
      await postSafeModeFeedback(
        {
          feedback_type: feedbackType,
          event_id: eventId ?? undefined,
          analysis_id: analysisId ?? undefined,
          metric_name: metricName,
        },
        currentOrganization?.id
      );
      setMessage('Geri bildiriminiz kaydedildi. Teşekkürler.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-eza-text-secondary">Kalibrasyon geri bildirimi</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            disabled={!canSubmit || submitting !== null}
            title={!canSubmit ? disabledReason : undefined}
            onClick={() => handleFeedback(opt.type)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              canSubmit
                ? 'border-eza-border bg-eza-surface hover:border-eza-accent hover:bg-eza-accent-muted text-eza-text'
                : 'border-eza-border bg-eza-surface-muted text-eza-text-muted cursor-not-allowed opacity-60'
            )}
          >
            {submitting === opt.type ? '…' : opt.label}
          </button>
        ))}
      </div>
      {!canSubmit ? (
        <p className="text-[10px] text-eza-text-muted">{disabledReason}</p>
      ) : null}
      {message ? <p className="text-xs text-eza-accent">{message}</p> : null}
    </div>
  );
}
