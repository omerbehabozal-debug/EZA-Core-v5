import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MirrorSohbetOpening from '@/components/mirror-landing/MirrorSohbetOpening';
import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import { pickMirrorLandingSurface } from '@/lib/eza/mirror-network/landingSurface';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicMirrorBySlug(slug, { revalidateSeconds: 300 });
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
  const result = await fetchPublicMirrorBySlug(slug);

  if (!result.ok) {
    notFound();
  }

  const surface = pickMirrorLandingSurface(result.data);

  return <MirrorSohbetOpening slug={surface.slug} cardTitle={surface.cardTitle} />;
}
