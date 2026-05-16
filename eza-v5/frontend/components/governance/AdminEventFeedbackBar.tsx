'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { postSafeModeFeedback } from '@/api/safemode';
import { useOrganization } from '@/context/OrganizationContext';

const ADMIN_FEEDBACK = [
  { label: 'Doğru', type: 'CORRECT' },
  { label: 'False positive', type: 'FALSE_POSITIVE' },
  { label: 'False negative', type: 'FALSE_NEGATIVE' },
  { label: 'Çok sert', type: 'TOO_STRICT' },
  { label: 'Çok yumuşak', type: 'TOO_SOFT' },
  { label: 'Yanlış kategori', type: 'WRONG_CATEGORY' },
  { label: 'Bağlam eksik', type: 'CONTEXT_MISSING' },
] as const;

export interface AdminEventFeedbackBarProps {
  eventId: string;
  metricName?: string;
  onSubmitted?: () => void;
  className?: string;
}

export default function AdminEventFeedbackBar({
  eventId,
  metricName,
  onSubmitted,
  className,
}: AdminEventFeedbackBarProps) {
  const { currentOrganization } = useOrganization();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async (feedbackType: string) => {
    setSubmitting(feedbackType);
    setMessage(null);
    try {
      await postSafeModeFeedback(
        {
          event_id: eventId,
          feedback_type: feedbackType,
          metric_name: metricName ?? 'admin_event_review',
        },
        currentOrganization?.id
      );
      setMessage('Geri bildirim kaydedildi.');
      onSubmitted?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-eza-text-secondary">Admin kalibrasyon geri bildirimi</p>
      <div className="flex flex-wrap gap-2">
        {ADMIN_FEEDBACK.map((opt) => (
          <button
            key={opt.type}
            type="button"
            disabled={submitting !== null}
            onClick={() => handleClick(opt.type)}
            className="rounded-full border border-eza-border bg-eza-surface px-2.5 py-1 text-[10px] sm:text-xs font-medium text-eza-text hover:border-eza-accent hover:bg-eza-accent-muted disabled:opacity-50"
          >
            {submitting === opt.type ? '…' : opt.label}
          </button>
        ))}
      </div>
      {message ? <p className="text-xs text-eza-accent">{message}</p> : null}
    </div>
  );
}
