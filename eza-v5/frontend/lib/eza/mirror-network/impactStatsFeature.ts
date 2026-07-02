/**
 * Owner Yansı stats UI — disabled by default until explicitly enabled in production.
 * Safe to enable after Faz 2.2 server-verified lineage proof.
 */

export function isSainaImpactStatsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAINA_IMPACT_STATS_ENABLED === 'true';
}
