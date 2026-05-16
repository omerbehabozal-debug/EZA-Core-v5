'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  STANDALONE_ANALYSIS_MODELS,
  getAnalysisModelById,
} from '@/lib/standaloneModels';

interface AnalyzedModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export default function AnalyzedModelSelect({
  value,
  onChange,
  disabled = false,
}: AnalyzedModelSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = getAnalysisModelById(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={standaloneSkin.modelBar}>
      <span className={standaloneSkin.modelBarLabel}>Analiz edilen model</span>
      <span className="text-standalone-text-muted/40" aria-hidden>
        ·
      </span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(standaloneSkin.modelTrigger, open && 'bg-black/[0.04] text-standalone-text')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Analiz edilen model: ${current.label}`}
        >
          <span className="truncate">{current.label}</span>
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 opacity-40 transition-transform',
              open && 'rotate-180 opacity-60'
            )}
          />
        </button>
        {open ? (
          <ul
            role="listbox"
            className={standaloneSkin.modelMenu}
            aria-label="Analiz edilen model"
          >
            {STANDALONE_ANALYSIS_MODELS.map((model) => {
              const active = model.id === value;
              return (
                <li key={model.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(standaloneSkin.modelMenuItem, active && 'bg-[#EEF4FF]/80')}
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                  >
                    <span className={standaloneSkin.modelMenuItemLabel}>{model.label}</span>
                    <span className={standaloneSkin.modelMenuItemMeta}>{model.provider}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
