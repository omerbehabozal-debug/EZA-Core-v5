/**
 * Owner Yansı stats UI — disabled by default until server-verified lineage ships.
 */

export function isSainaImpactStatsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED === 'true';
}
