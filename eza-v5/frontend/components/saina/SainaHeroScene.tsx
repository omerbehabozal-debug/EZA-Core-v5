'use client';

import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';
import SainaGeometricMark from './SainaGeometricMark';

type SainaHeroSceneProps = {
  title?: string;
};

/**
 * Stage 6 identity header — conversation title only.
 * No fabricated @handle, Bilgin badge, or 8-step progress.
 */
export default function SainaHeroScene({ title = SAINA_HERO_DEFAULT_TITLE }: SainaHeroSceneProps) {
  return (
    <section className="saina-hero saina-hero--content bilign-yansi-identity" aria-label="Aktif sohbet başlığı">
      <div className="bilign-yansi-identity__mark" aria-hidden>
        <svg className="bilign-avatar-orbit bilign-avatar-orbit--outer" viewBox="0 0 72 72" fill="none">
          <path
            d="M36 6 L54.5 13.5 L65.5 29.5 L62 48.5 L46.5 62 L27.5 64.5 L12 52.5 L7.5 33.5 L18 15.5 Z"
            stroke="rgba(183,137,73,0.48)"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg className="bilign-avatar-orbit bilign-avatar-orbit--inner" viewBox="0 0 72 72" fill="none">
          <path
            d="M36 10 L51 16.5 L60 30 L57 46 L44 57 L28 58.5 L16 48 L13 32.5 L22.5 18 Z"
            stroke="rgba(208,161,91,0.72)"
            strokeWidth="0.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="bilign-yansi-identity__glyph">
          <SainaGeometricMark size={28} variant="gold" />
        </div>
      </div>
      <h1 className="saina-hero-title">{title}</h1>
    </section>
  );
}
