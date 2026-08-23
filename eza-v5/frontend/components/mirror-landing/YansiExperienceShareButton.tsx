'use client';

import { useState } from 'react';
import { Share } from 'lucide-react';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { sharePublishedYansi } from '@/lib/eza/mirror/yansiExperienceShare';

export default function YansiExperienceShareButton({ slug }: { slug: string }) {
  const isDesktop = useSainaCompactShell();
  const [copied, setCopied] = useState(false);

  if (!isDesktop || !slug.trim()) return null;

  return (
    <button
      type="button"
      className="yansi-exp-share"
      data-testid="yansi-experience-share"
      aria-label="Yansı'yı paylaş"
      title="Yansı'yı paylaş"
      onClick={async () => {
        const result = await sharePublishedYansi(slug);
        if (result === 'copied') {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      <Share size={16} strokeWidth={1.6} aria-hidden />
      <span className="sr-only">{copied ? 'Bağlantı kopyalandı' : "Yansı'yı paylaş"}</span>
    </button>
  );
}
