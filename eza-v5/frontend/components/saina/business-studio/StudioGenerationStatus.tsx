'use client';

import {
  studioErrorMessage,
  studioStatusLabel,
  type StudioGeneration,
  type StudioStatus,
} from '@/lib/eza/businessStudio';

type Props = {
  generation: StudioGeneration | null;
  phaseLabel: string;
  busy?: boolean;
};

function tone(status: StudioStatus | null): string {
  if (!status) return 'idle';
  if (status === 'completed' || status === 'succeeded') return 'ok';
  if (status === 'failed' || status === 'expired' || status === 'cancelled') return 'danger';
  if (status === 'blocked') return 'warn';
  return 'live';
}

export default function StudioGenerationStatus({ generation, phaseLabel, busy }: Props) {
  const status = generation?.status ?? null;
  const label = status ? studioStatusLabel(status) : busy ? 'Başlatılıyor' : 'Hazır';
  const message =
    generation?.errorCode != null
      ? studioErrorMessage(generation.errorCode)
      : status === 'running' || status === 'queued' || status === 'pending'
        ? 'Üretim sürüyor. Bu işlem ücretli olabilir; lütfen bekleyin ve tekrar tıklamayın.'
        : status === 'blocked' && !generation?.executionAvailable
          ? studioErrorMessage(generation?.errorCode || 'studio_execution_not_implemented')
          : null;

  return (
    <div
      className={`biz-studio-status biz-studio-status--${tone(status)}`}
      data-testid="biz-studio-generation-status"
      data-status={status || 'idle'}
      role="status"
      aria-live="polite"
    >
      <div className="biz-studio-status-row">
        <span className="biz-studio-status-phase">{phaseLabel}</span>
        <span className="biz-studio-status-pill">{label}</span>
      </div>
      {message ? <p className="biz-studio-status-msg">{message}</p> : null}
      {generation?.generationId ? (
        <p className="biz-studio-status-meta">İşlem kimliği: {generation.generationId}</p>
      ) : null}
    </div>
  );
}
