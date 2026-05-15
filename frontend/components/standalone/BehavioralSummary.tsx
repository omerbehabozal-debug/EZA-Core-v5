'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BehavioralSnapshot } from '@/lib/types';

interface BehavioralSummaryProps {
  data: BehavioralSnapshot;
}

export default function BehavioralSummary({ data }: BehavioralSummaryProps) {
  const [open, setOpen] = useState(false);
  const v = data.vector;
  const a = data.asymmetry;
  const shortId = data.interaction_id?.slice(0, 8) ?? '—';

  return (
    <div className="mt-1.5 w-full max-w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-medium touch-manipulation"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        Etkileşim özeti (davranış)
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2 py-2 text-[10px] sm:text-xs text-gray-700 space-y-1.5 font-mono leading-snug break-all">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>id:{shortId}…</span>
            <span>v{data.schema_version}</span>
            <span>{data.mode}</span>
          </div>
          <div className="text-gray-600">
            asimetri: <span className="text-gray-900">{a.index}</span> · gap: {a.health_gap} · Δrisk:{' '}
            {a.risk_delta_output_minus_input}
          </div>
          <div className="text-gray-600">
            girdi risk: {v.input_risk} · çıktı risk: {v.output_risk} · hizalama:{' '}
            {v.alignment_score ?? '—'} · EZA: {v.eza_final ?? '—'}
          </div>
          <div className="text-gray-600">
            niyet: {v.intent}
            {v.alignment_verdict ? ` · ${v.alignment_verdict}` : ''}
            {v.redirect ? ' · yönlendirme' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
