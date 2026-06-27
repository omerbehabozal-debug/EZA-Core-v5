'use client';

import Link from 'next/link';
import { trackSeedStart } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';

export type MirrorLandingCtaProps = {
  slug: string;
};

export default function MirrorLandingCta({ slug }: MirrorLandingCtaProps) {
  const href = `/m/${slug}/sohbet`;

  return (
    <div className="mt-auto pt-10">
      <Link
        href={href}
        onClick={() => trackSeedStart(slug)}
        className="flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/40 bg-[#e8d5b5]/15 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/25"
      >
        Bu konudan devam et
      </Link>
    </div>
  );
}
