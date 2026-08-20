import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MirrorLandingExperience from '@/components/mirror-landing/MirrorLandingExperience';
import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import {
  assertMirrorLandingSurfaceClean,
  pickMirrorLandingSurface,
} from '@/lib/eza/mirror-network/landingSurface';

/** Phase 8.4.1 — trust-authoritative; withdrawn Yansı must not linger in page cache. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicMirrorBySlug(slug, { trustAuthoritative: true });
  if (!result.ok) {
    return { title: 'Ayna bulunamadı · SAINA' };
  }
  const surface = pickMirrorLandingSurface(result.data);
  return {
    title: `${surface.cardTitle} · SAINA`,
    description: surface.curiosityContext.slice(0, 160),
    openGraph: surface.sceneImageUrl
      ? { images: [{ url: surface.sceneImageUrl, width: 1080, height: 1350 }] }
      : undefined,
  };
}

export default async function MirrorLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await fetchPublicMirrorBySlug(slug, { trustAuthoritative: true });

  if (!result.ok) {
    notFound();
  }

  const surface = pickMirrorLandingSurface(result.data);
  assertMirrorLandingSurfaceClean(surface);

  return <MirrorLandingExperience surface={surface} />;
}
