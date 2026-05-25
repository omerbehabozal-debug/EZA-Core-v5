'use client';

import { cn } from '@/lib/utils';
import type { BehaviorIsland } from '@/lib/eza/relationshipMapModel';
import { islandBlobSizePx } from '@/lib/eza/mirror/relationshipPatternMetrics';
import {
  Compass,
  GitCompare,
  Lightbulb,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const ICONS: Record<string, typeof Sparkles> = {
  exploration: Compass,
  decision_support: GitCompare,
  clarity_seek: Search,
  creative_ideas: Lightbulb,
  intellectual_depth: Sparkles,
  explanation_seek: Search,
  safe_balance: ShieldCheck,
  flow_harmony: Sparkles,
};

function pickIcon(id: string) {
  return ICONS[id] ?? Sparkles;
}

export type BehaviorIslandBlobProps = {
  island: BehaviorIsland;
  className?: string;
  style?: React.CSSProperties;
  ghost?: boolean;
};

export default function BehaviorIslandBlob({
  island,
  className,
  style,
  ghost = false,
}: BehaviorIslandBlobProps) {
  const size = islandBlobSizePx(island.percent);
  const Icon = pickIcon(island.id);

  return (
    <article
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-full border text-center transition-transform duration-300',
        ghost ? 'opacity-40' : 'hover:scale-[1.03]',
        className
      )}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderColor: `${island.color}44`,
        background: `radial-gradient(circle at 32% 28%, ${island.color}33, ${island.color}18 55%, transparent 72%)`,
        boxShadow: `0 16px 48px -12px ${island.color}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-2 rounded-full opacity-60 blur-md"
        style={{ background: `radial-gradient(circle, ${island.color}40, transparent 70%)` }}
        aria-hidden
      />
      <Icon
        className="relative mb-1 h-4 w-4 opacity-80"
        style={{ color: island.color }}
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="relative max-w-[88%] text-[10px] font-semibold leading-tight text-[#172033]/90">
        {island.label}
      </p>
      <p className="relative mt-0.5 text-[11px] font-bold tabular-nums text-[#7B61FF]">
        %{island.percent}
      </p>
    </article>
  );
}
