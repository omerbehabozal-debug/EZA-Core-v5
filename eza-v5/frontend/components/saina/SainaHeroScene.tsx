'use client';

import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';

type SainaHeroSceneProps = {
  title?: string;
};

export default function SainaHeroScene({ title = SAINA_HERO_DEFAULT_TITLE }: SainaHeroSceneProps) {
  return (
    <section className="saina-hero saina-hero--content" aria-label="Aktif sohbet başlığı">
      <h1 className="saina-hero-title saina-serif">{title}</h1>
    </section>
  );
}
