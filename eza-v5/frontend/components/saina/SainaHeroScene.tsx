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
}: SainaHeroSceneProps) {
  const name = displayName?.trim() || SAINA_MENU_GUEST_LABEL;
  const showHonorific = Boolean(honorificLabel);

  return (
    <section
      className="saina-hero saina-hero--content bilign-yansi-identity"
      aria-label="Yansı kimliği"
      data-testid="saina-yansi-identity"
    >
      <BilignAvatarIdentityFrame variant="hero" className="bilign-yansi-identity__mark">
        <ProfileUserAvatar
          displayName={name}
          userId={userId}
          avatarUrl={avatarUrl}
          cacheBust={avatarCacheBust}
          size="hero"
          className="bilign-yansi-identity__face"
        />
      </BilignAvatarIdentityFrame>
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
        <h1 className="saina-hero-title">{title}</h1>
      </div>
    </section>
  );
}
