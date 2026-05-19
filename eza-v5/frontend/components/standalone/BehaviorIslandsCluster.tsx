'use client';

import { cn } from '@/lib/utils';
import { TREND_LABEL, type BehaviorIsland } from '@/lib/eza/relationshipMapModel';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import MapConnectors from '@/components/standalone/MapConnectors';

const s = standaloneSkin.relationshipMapPolish;
const mot = standaloneSkin.motion;

/** Organic cluster positions for up to 6 islands (mockup-style map). */
const CLUSTER_SLOTS: { left: string; top: string; width: string; z: number }[] = [
  { left: '2%', top: '6%', width: '44%', z: 2 },
  { left: '36%', top: '0%', width: '40%', z: 4 },
  { left: '58%', top: '20%', width: '36%', z: 3 },
  { left: '6%', top: '40%', width: '38%', z: 5 },
  { left: '40%', top: '46%', width: '42%', z: 6 },
  { left: '64%', top: '56%', width: '32%', z: 2 },
];

interface BehaviorIslandsClusterProps {
  islands: BehaviorIsland[];
  fadeKey: number;
  reducedMotion: boolean;
}

function islandOpacity(trend: BehaviorIsland['trend']): number {
  if (trend === 'growing') return 1;
  if (trend === 'fading') return 0.76;
  return 0.9;
}

export default function BehaviorIslandsCluster({
  islands,
  fadeKey,
  reducedMotion,
}: BehaviorIslandsClusterProps) {
  const visible = islands.slice(0, 6);
  const showConnectors = visible.length >= 2 && !reducedMotion;

  return (
    <div className={s.islandsCluster} aria-label="Davranış adaları haritası">
      <div className={s.islandsCanvasMesh} aria-hidden />
      <div className={s.islandsClusterGlow} aria-hidden />
      {showConnectors ? <MapConnectors /> : null}
      {visible.map((island, index) => {
        const slot = CLUSTER_SLOTS[index] ?? CLUSTER_SLOTS[0]!;
        const trend = island.trend ?? 'stable';
        const memoryEffect = island.percent < 8;

        return (
          <article
            key={`${island.id}-${fadeKey}`}
            className={cn(
              s.islandBlobCluster,
              s.islandBlobResponsive,
              !reducedMotion && mot.islandEnter,
              trend === 'growing' && s.islandGrowing,
              trend === 'fading' && s.islandFading,
              memoryEffect && s.islandGhost
            )}
            style={{
              left: slot.left,
              top: slot.top,
              width: slot.width,
              zIndex: slot.z,
              minHeight: `${Math.round(88 + island.intensity * 52)}px`,
              borderColor: `${island.color}55`,
              background: `linear-gradient(155deg, ${island.color}22, ${island.color}40)`,
              opacity: islandOpacity(trend),
              boxShadow: `0 14px 44px -14px ${island.color}48`,
              animationDelay: reducedMotion ? undefined : `${index * 0.08}s`,
            }}
          >
            {memoryEffect ? <div className={s.connectionHint} aria-hidden /> : null}
            <div
              className={s.islandGlow}
              style={{
                background: `radial-gradient(circle, ${island.color}55, transparent 70%)`,
              }}
              aria-hidden
            />
            <h4 className={s.islandLabel}>{island.label}</h4>
            <p className={s.islandDesc}>{island.description}</p>
            <div className={s.islandMeta}>
              <span className={s.islandTrendPill}>{TREND_LABEL[trend]}</span>
              <span className={s.islandPercentMuted}>· {island.percent}%</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
