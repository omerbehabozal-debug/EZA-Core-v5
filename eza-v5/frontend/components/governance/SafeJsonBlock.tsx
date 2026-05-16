'use client';

import { sanitizeRecord, isForbiddenKey } from '@/lib/governance/display';

export default function SafeJsonBlock({
  data,
  title,
}: {
  data: Record<string, unknown> | unknown[] | null | undefined;
  title: string;
}) {
  let text = '—';
  if (data != null) {
    if (Array.isArray(data)) {
      text = JSON.stringify(data, null, 2);
    } else if (typeof data === 'object') {
      text = JSON.stringify(sanitizeRecord(data as Record<string, unknown>), null, 2);
    } else {
      text = String(data);
    }
  }

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-eza-text-muted mb-1.5">
        {title}
      </p>
      <pre className="max-h-48 overflow-auto rounded-lg border border-eza-border bg-eza-surface-muted p-3 text-[11px] font-mono text-eza-text-secondary leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

/** Filter engine_votes for display */
export function sanitizeEngineVotes(
  votes: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!votes || typeof votes !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [engine, payload] of Object.entries(votes)) {
    if (isForbiddenKey(engine)) continue;
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      out[engine] = sanitizeRecord(payload as Record<string, unknown>);
    } else if (typeof payload === 'number' || typeof payload === 'boolean') {
      out[engine] = payload;
    }
  }
  return out;
}
