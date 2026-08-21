'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';

type SainaYansiContextRailProps = {
  mirrorOpen: boolean;
  onOpenAyna: () => void;
  onCloseAyna: () => void;
  className?: string;
};

/**
 * Desktop contextual rail — only wires real actions (Ayna open/close).
 * No fake Sakla / fullscreen / metrics buttons.
 * Keeps `saina-mirror-expand-pill` test id while collapsed for regression suites.
 */
export default function SainaYansiContextRail({
  mirrorOpen,
  onOpenAyna,
  onCloseAyna,
  className,
}: SainaYansiContextRailProps) {
  return (
    <aside
      className={cn('bilign-context-rail', mirrorOpen && 'bilign-context-rail--active', className)}
      data-testid="bilign-context-rail"
      aria-label="Yansı kontrolleri"
    >
      {!mirrorOpen ? (
        <button
          type="button"
          className="bilign-context-rail__btn bilign-context-rail__btn--ayna saina-mirror-expand-pill"
          data-testid="saina-mirror-expand-pill"
          aria-label={SAINA_MIRROR_EXPAND_LABEL}
          onClick={onOpenAyna}
        >
          <Sparkles size={18} className="saina-mirror-expand-sparkle" aria-hidden />
          <span className="bilign-context-rail__label saina-mirror-expand-label">
            {SAINA_MIRROR_EXPAND_TAB}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="bilign-context-rail__btn bilign-context-rail__btn--active"
          data-testid="bilign-context-rail-ayna"
          aria-label={SAINA_MIRROR_EXPAND_LABEL}
          aria-pressed
          onClick={onOpenAyna}
        >
          <Sparkles size={18} aria-hidden />
          <span className="bilign-context-rail__label">{SAINA_MIRROR_EXPAND_TAB}</span>
        </button>
      )}
      <button
        type="button"
        className="bilign-context-rail__btn"
        data-testid="bilign-context-rail-close"
        aria-label="Ayna panelini kapat"
        disabled={!mirrorOpen}
        onClick={onCloseAyna}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </aside>
  );
}
