import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import SainaBrandWordmark from '@/components/saina/SainaBrandWordmark';
import {
  assertMirrorLandingSurfaceClean,
} from '@/lib/eza/mirror-network/landingSurface';
import { resolvePublicMirrorLanding } from '@/lib/eza/mirror-network/resolvePublicMirrorLanding';
import { SAINA_BRAND } from '@/lib/eza/sainaCopy';

/** Phase 8.4.1 — trust-authoritative; withdrawn Yansı must not linger in page cache. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toSearchParams(
  raw: Record<string, string | string[] | undefined> | undefined
): URLSearchParams {
  const params = new URLSearchParams();
  if (!raw) return params;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      params.set(key, value[0]);
    }
  }
  return params;
}

function MirrorLandingTemporaryUnavailable() {
  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0c0b0a] px-6 text-center text-[#f4f0e8]"
      data-testid="mirror-landing-temporary"
    >
      <SainaBrandWordmark height={16} />
      <h1 className="mt-4 font-serif text-2xl font-medium text-[#faf6ee]">
        Deneyim şu an açılamıyor
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#a89f92]">
        Geçici bir bağlantı sorunu olabilir. Biraz sonra yeniden deneyin.
      </p>
    </main>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = toSearchParams(searchParams ? await searchParams : undefined);
  const resolved = await resolvePublicMirrorLanding({
    slug,
    searchParams: query,
  });
  if (!resolved.ok) {
    return { title: `Ayna bulunamadı · ${SAINA_BRAND}` };
  }
  const { surface } = resolved;
  return {
    title: `${surface.cardTitle} · ${SAINA_BRAND}`,
    description: (surface.curiosityContext || surface.cardTitle).slice(0, 160),
    openGraph: surface.sceneImageUrl
      ? { images: [{ url: surface.sceneImageUrl, width: 1080, height: 1350 }] }
      : undefined,
  };
}

export default async function MirrorLandingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = toSearchParams(searchParams ? await searchParams : undefined);
  const resolved = await resolvePublicMirrorLanding({
    slug,
    searchParams: query,
  });

  if (!resolved.ok) {
    if (resolved.reason === 'temporary') {
      return <MirrorLandingTemporaryUnavailable />;
    }
    notFound();
  }

  const { surface } = resolved;
  assertMirrorLandingSurfaceClean(surface);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#090b0b] text-sm text-[#a89880]">
          Deneyim hazırlanıyor…
        </div>
      }
    >
      <MirrorLandingExperience surface={surface} />
    </Suspense>
  );
}
