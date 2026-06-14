'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_READY_BADGE } from '@/lib/eza/sainaCopy';
import {
  getMirrorMobileCtaLabel,
  resolveMirrorMobileState,
  type MirrorMobileContext,
} from '@/lib/eza/mirrorMobileState';
import SainaStandaloneMirrorPanel from './SainaStandaloneMirrorPanel';

type SainaMobileMirrorRailProps = {
  context: MirrorMobileContext;
  panelOpen: boolean;
  onOpen: () => void;
  onCollapse: () => void;
};

export default function SainaMobileMirrorRail({
  context,
  panelOpen,
  onOpen,
  onCollapse,
}: SainaMobileMirrorRailProps) {
  const state = resolveMirrorMobileState(context, panelOpen);

  if (state === 'panel_open') {
    return (
      <div
        className="saina-mobile-mirror-rail saina-mobile-mirror-rail--open"
        data-testid="saina-mobile-mirror-inline"
        data-mirror-mobile-state={state}
      >
        <SainaStandaloneMirrorPanel showCollapse onCollapse={onCollapse} />
      </div>
    );
  }

  const ctaLabel = getMirrorMobileCtaLabel(state);

  return (
    <div
      className="saina-mobile-mirror-rail"
      data-testid="saina-mobile-mirror-inline"
      data-mirror-mobile-state={state}
    >
      <button
        type="button"
        className={cn(
          'saina-mobile-mirror-cta',
          state === 'signal_ready' && 'saina-mobile-mirror-cta--signal'
        )}
        data-testid="saina-mobile-mirror-cta"
        onClick={onOpen}
        aria-label={SAINA_MIRROR_EXPAND_LABEL}
      >
        <Sparkles size={16} className="saina-mobile-mirror-cta-icon" aria-hidden />
        <span className="saina-mobile-mirror-cta-label">{ctaLabel}</span>
        {state === 'signal_ready' ? (
          <span className="saina-mobile-mirror-cta-badge" data-testid="saina-mobile-mirror-cta-badge">
            {SAINA_MIRROR_READY_BADGE}
          </span>
        ) : null}
      </button>
    </div>
  );
}
