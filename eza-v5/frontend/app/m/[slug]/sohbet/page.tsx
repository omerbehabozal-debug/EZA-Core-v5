import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MirrorSohbetOpening from '@/components/mirror-landing/MirrorSohbetOpening';
import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import { pickMirrorLandingSurface } from '@/lib/eza/mirror-network/landingSurface';

/** Phase 8.4.1 — trust-authoritative sohbet entry; no stale public slug. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicMirrorBySlug(slug, { trustAuthoritative: true });
  if (!result.ok) {
    return { title: 'Sohbet · SAINA' };
  }
  const surface = pickMirrorLandingSurface(result.data);
  return {
    title: `Sohbet · ${surface.cardTitle}`,
    description: 'Bu merak senin sorularınla devam ediyor.',
  };
}

export default async function MirrorSohbetPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await fetchPublicMirrorBySlug(slug, { trustAuthoritative: true });

  if (!result.ok) {
    notFound();
  }

  const surface = pickMirrorLandingSurface(result.data);

  return <MirrorSohbetOpening slug={surface.slug} cardTitle={surface.cardTitle} />;
}
