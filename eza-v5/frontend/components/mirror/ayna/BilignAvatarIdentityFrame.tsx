'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AVATAR_IDENTITY_POLYGON_A_POINTS,
  AVATAR_IDENTITY_POLYGON_B_POINTS,
  AVATAR_IDENTITY_POLYGON_A,
  AVATAR_IDENTITY_POLYGON_B,
} from '@/lib/eza/profile/avatarIdentityFrameGeometry';

export type BilignAvatarIdentityFrameVariant = 'hero' | 'profile' | 'mobile';

export type BilignAvatarIdentityFrameProps = {
  variant: BilignAvatarIdentityFrameVariant;
  children: ReactNode;
  className?: string;
};

/**
 * Overlapping double-polygon presentation frame — circular photo, polygon contour.
 * Does not alter avatar source, crop, or interaction targets.
 */
export default function BilignAvatarIdentityFrame({
  variant,
  children,
  className,
}: BilignAvatarIdentityFrameProps) {
  return (
    <div
      className={cn('bilign-avatar-identity-frame', `bilign-avatar-identity-frame--${variant}`, className)}
      data-testid="bilign-avatar-identity-frame"
      data-frame-variant={variant}
    >
      <div className="bilign-avatar-identity-frame__avatar">{children}</div>
      <svg
        className="bilign-avatar-identity-polygons"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
      >
        <polygon
          className="bilign-avatar-identity-polygon bilign-avatar-identity-polygon--a"
          points={AVATAR_IDENTITY_POLYGON_A_POINTS}
          style={{ opacity: AVATAR_IDENTITY_POLYGON_A.opacity }}
        />
        <polygon
          className="bilign-avatar-identity-polygon bilign-avatar-identity-polygon--b"
          points={AVATAR_IDENTITY_POLYGON_B_POINTS}
          style={{ opacity: AVATAR_IDENTITY_POLYGON_B.opacity }}
        />
      </svg>
    </div>
  );
}
