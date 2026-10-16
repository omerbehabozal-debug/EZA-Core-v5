'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { resolvePublicAuthorIdentity, type PublicAuthorIdentity } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import type { PublicReplayContext } from '@/lib/eza/mirror-network/publicReplayContinuation';

export default function YansiPersonalSourceIdentity({ context, avatarOnly = false }: { context: PublicReplayContext; avatarOnly?: boolean }) {
  const [author, setAuthor] = useState<PublicAuthorIdentity | null>(null);
  useEffect(() => {
    let active = true;
    setAuthor(null);
    if (context.businessPublisher) return () => { active = false; };
    void resolvePublicAuthorIdentity(context.authorUserId).then((value) => { if (active) setAuthor(value); });
    return () => { active = false; };
  }, [context.authorUserId, context.businessPublisher]);
  const name = context.businessPublisher?.displayName || author?.displayName || PUBLIC_DISPLAY_NAME_FALLBACK;
  return <Link href={`/m/${encodeURIComponent(context.slug)}`} className={avatarOnly ? 'yansi-personal-source-avatar' : 'yansi-personal-source-caption'}
    aria-label={`Kaynak Yansı'ya dön: ${context.publicTitle}`} data-testid={avatarOnly ? 'yansi-personal-source-avatar' : 'yansi-personal-source-link'}>
    {avatarOnly ? <ProfileUserAvatar displayName={name} userId={context.authorUserId} avatarUrl={context.businessPublisher?.logoUrl ?? author?.publicAvatarUrl ?? null}
      cacheBust={author?.publicAvatarRevision ?? undefined} size="sm" className="yansi-personal-source-face" /> : <>Kaynak Yansı: {context.publicTitle} · {name}</>}
  </Link>;
}
