'use client';

/**
 * QA-only — Stage 04C V2 public → MirrorFrozenReplay visual harness.
 * Uses the same public Deneyimle chrome as production. Not a product route.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { mapV2PublicToFrozenArtifact } from '@/lib/eza/mirror/journey/mapV2PublicToFrozenArtifact';
import { parseYansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import '@/styles/saina-mirror.css';
import '@/styles/saina-yansi-desktop.css';
import '@/styles/yansi-reel-responsive.css';
import '@/styles/saina-my-page.css';
import '@/styles/saina-business.css';

const COVER = '/mirror/dev-italy-scene.jpg';
const BIZ = '11111111-1111-1111-1111-111111111111';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const coverPath = `/api/business-yansi/public-media/${BIZ}/${ASSET}`;

function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function buildFixture(kind: 'conversation' | 'image'): PublicFrozenJourneyArtifact | null {
  if (kind === 'image') {
    const pub = parseYansiV2PublicPublication({
      status: 'ok',
      slug: 'dev-v2-photo',
      publicationVersion: 1,
      isCurrent: true,
      contentKind: 'image',
      businessPublisher: {
        businessId: BIZ,
        slug: 'dev-biz',
        displayName: 'Dev Fırın',
        logoUrl: null,
        verified: true,
        official: true,
      },
      public: {
        slug: 'dev-v2-photo',
        media: { assetId: ASSET, contentPath: coverPath, title: 'Vitrin' },
      },
    });
    const mapped = pub ? mapV2PublicToFrozenArtifact(pub) : null;
    if (!mapped) return null;
    // Prefer local fixture scene — public-media paths may 404 offline.
    return {
      ...mapped,
      sceneImageUrl: COVER,
      businessMedia: mapped.businessMedia
        ? { ...mapped.businessMedia, cover: null }
        : undefined,
    };
  }

  const pub = parseYansiV2PublicPublication({
    status: 'ok',
    slug: 'dev-v2-cafe',
    publicationVersion: 2,
    isCurrent: true,
    contentKind: 'conversation',
    businessPublisher: {
      businessId: BIZ,
      slug: 'dev-biz',
      displayName: 'Dev Fırın',
      logoUrl: null,
      verified: true,
      official: true,
    },
    public: {
      slug: 'dev-v2-cafe',
      conversation: {
        turnCount: 2,
        curiosityQuestion: 'Fırın neden şafakta açılır?',
        turns: [
          {
            stepIndex: 1,
            question: 'Fırın neden şafakta açılır?',
            answer:
              'Hamur gece dinlenir; sabah ısı, kabuk ve aroma için en doğru zamandır.',
            media: [],
          },
          {
            stepIndex: 2,
            question: 'Misafire hangi ekmek önerilir?',
            answer: 'İnce kabuklu köy ekmeği — ilk gün için.',
            media: [],
          },
        ],
      },
      cover: { assetId: ASSET, title: 'Kapak', contentPath: coverPath },
    },
  });
  const mapped = pub ? mapV2PublicToFrozenArtifact(pub) : null;
  if (!mapped) return null;
  // Local fixture scene (public-media path is shape-valid but may 404 offline).
  return {
    ...mapped,
    sceneImageUrl: COVER,
    businessMedia: mapped.businessMedia
      ? { ...mapped.businessMedia, cover: null }
      : undefined,
  };
}

export default function DevYansiV2ExperiencePage() {
  const [blocked, setBlocked] = useState(false);
  const [kind, setKind] = useState<'conversation' | 'image'>('conversation');
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const isDevEnv = process.env.NODE_ENV === 'development';
    const isLocal = isLocalDevHost(window.location.hostname);
    setBlocked(!isDevEnv && !isLocal);
  }, []);

  const artifact = useMemo(() => buildFixture(kind), [kind]);

  if (blocked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Bu QA rotası yalnızca local/dev için.</p>
        <Link href="/">Ana sayfa</Link>
      </main>
    );
  }

  if (!artifact) {
    return <main style={{ padding: 24 }}>Fixture üretilemedi.</main>;
  }

  return (
    <main
      className="min-h-[100dvh] bg-[#090b0b] text-[#f4f0e8]"
      data-testid="dev-yansi-v2-experience"
      data-fixture-kind={kind}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 text-sm">
        <Link href="/dev/yansi-studio-preview" className="underline">
          Studio preview
        </Link>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-1"
          onClick={() => setKind('conversation')}
        >
          Conversation
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-1"
          onClick={() => setKind('image')}
        >
          Image-only
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-1"
          onClick={() => setNarrow((v) => !v)}
        >
          {narrow ? 'Desktop width' : 'Mobile width'}
        </button>
        <span className="text-[#a89880]">
          v{artifact.journeyVersion} · {artifact.sourceKind}
        </span>
      </div>
      <div
        className={
          narrow
            ? 'mx-auto h-[100dvh] max-w-[390px] overflow-hidden'
            : 'mx-auto h-[100dvh] max-w-[1100px]'
        }
      >
        <YansiExperienceSessionProvider slug={artifact.slug}>
          <MirrorFrozenReplay
            artifact={artifact}
            desktopIdentity={{
              title: artifact.publicTitle || artifact.publicSummary || artifact.slug,
              displayName: artifact.businessPublisher?.displayName ?? 'Dev',
              authorUserId: artifact.authorUserId,
              honorific: null,
              avatarUrl: null,
              timeLabel: null,
              businessLabel: artifact.businessPublisher ? 'Business' : undefined,
            }}
            mobilePresentation={narrow}
          />
        </YansiExperienceSessionProvider>
      </div>
    </main>
  );
}
