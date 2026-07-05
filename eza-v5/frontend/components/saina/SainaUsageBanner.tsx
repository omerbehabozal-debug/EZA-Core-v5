'use client';

import { cn } from '@/lib/utils';
import {
  buildAccountUsageLines,
  formatAccountUsageValue,
  shouldShowAccountUsageBanner,
} from '@/lib/eza/plan/sainaUsageSummary';
import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';
import { SAINA_USAGE_TODAY_LABEL, SAINA_USAGE_UNAVAILABLE } from '@/lib/eza/sainaCopy';

export type SainaUsageBannerProps = {
  snapshot: AccountEntitlementsResponse;
  className?: string;
  onUpgrade?: () => void;
};

export default function SainaUsageBanner({
  snapshot,
  className,
  onUpgrade,
}: SainaUsageBannerProps) {
  if (!shouldShowAccountUsageBanner(snapshot)) return null;

  const lines = buildAccountUsageLines(snapshot);
  const showVisualUnavailable =
    snapshot.entitlements.dailyMirrorLimit === 0 && snapshot.tier !== 'premium';

  return (
    <div
      className={cn('saina-usage-banner', className)}
      data-testid="saina-usage-banner"
      aria-label={SAINA_USAGE_TODAY_LABEL}
    >
      <div className="saina-usage-banner__header">
        <p className="saina-usage-banner__title">{SAINA_USAGE_TODAY_LABEL}</p>
        {onUpgrade ? (
          <button type="button" className="saina-usage-banner__upgrade" onClick={onUpgrade}>
            Yükselt
          </button>
        ) : null}
      </div>
      <dl className="saina-usage-banner__grid">
        {lines.map((line) => (
          <div
            key={line.key}
            className={cn('saina-usage-banner__row', line.atLimit && 'saina-usage-banner__row--limit')}
          >
            <dt>{line.label}</dt>
            <dd>{formatAccountUsageValue(line)}</dd>
          </div>
        ))}
        {showVisualUnavailable ? (
          <div className="saina-usage-banner__row saina-usage-banner__row--muted">
            <dt>Görsel</dt>
            <dd>{SAINA_USAGE_UNAVAILABLE}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
