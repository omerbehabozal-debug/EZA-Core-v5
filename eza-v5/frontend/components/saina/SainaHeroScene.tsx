'use client';

import '@/styles/bilign-avatar-identity-frame.css';
import { SAINA_HERO_DEFAULT_TITLE, SAINA_MENU_GUEST_LABEL } from '@/lib/eza/sainaCopy';
import BilignAvatarIdentityFrame from '@/components/mirror/ayna/BilignAvatarIdentityFrame';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import type { PublicHonorificId } from '@/lib/eza/mirror/publicHonorific';

type SainaHeroSceneProps = {
  title?: string;
  displayName?: string;
  honorificId?: PublicHonorificId | null;
  honorificLabel?: string | null;
  userId?: string | null;
  avatarUrl?: string | null;
  avatarCacheBust?: number | string;
  /** Compact time label for hero metadata row (server-known timestamp). */
  metaTimeLabel?: string | null;
  /** Product-authoritative content type (e.g. Yeni sohbet, Yansı). */
  metaTypeLabel?: string | null;
};

/**
 * Yansı creator identity — public name + honorific + this conversation's curiosity.
 * No fabricated handle, plan/tier, or 8-step progress.
 */
export default function SainaHeroScene({
  title = SAINA_HERO_DEFAULT_TITLE,
  displayName,
  honorificId = null,
  honorificLabel = null,
  userId = null,
  avatarUrl = null,
  avatarCacheBust,
  metaTimeLabel = null,
  metaTypeLabel = null,
}: SainaHeroSceneProps) {
  const name = displayName?.trim() || SAINA_MENU_GUEST_LABEL;
  const showHonorific = Boolean(honorificLabel);
  const timeLabel = metaTimeLabel?.trim() || '';
  const typeLabel = metaTypeLabel?.trim() || '';
  const showMeta = Boolean(timeLabel || typeLabel);

  return (
    <section
      className="saina-hero saina-hero--content bilign-yansi-identity"
      aria-label="Yansı kimliği"
      data-testid="saina-yansi-identity"
    >
      <div className="bilign-yansi-identity__mark">
        <div className="bilign-yansi-identity__avatar">
          <BilignAvatarIdentityFrame variant="hero">
            <ProfileUserAvatar
              displayName={name}
              userId={userId}
              avatarUrl={avatarUrl}
              cacheBust={avatarCacheBust}
              size="hero"
              className="bilign-yansi-identity__face"
            />
          </BilignAvatarIdentityFrame>
        </div>
      </div>
      <div className="bilign-yansi-identity__copy">
        <div className="bilign-yansi-identity__name-row">
          <p className="bilign-yansi-identity__name" data-testid="saina-yansi-identity-name">
            {name}
          </p>
          {showHonorific ? (
            <HonorificMarker
              honorific={honorificId}
              testId="saina-yansi-identity-honorific"
            />
          ) : null}
        </div>
        {showMeta ? (
          <p className="bilign-yansi-identity__meta" data-testid="saina-yansi-identity-meta">
            {timeLabel ? (
              <span data-testid="saina-yansi-identity-meta-time">{timeLabel}</span>
            ) : null}
            {timeLabel && typeLabel ? (
              <span className="bilign-yansi-identity__meta-sep" aria-hidden="true">
                {' '}
                ·{' '}
              </span>
            ) : null}
            {typeLabel ? (
              <span data-testid="saina-yansi-identity-meta-type">{typeLabel}</span>
            ) : null}
          </p>
        ) : null}
        <h1 className="saina-hero-title">{title}</h1>
      </div>
    </section>
  );
}
