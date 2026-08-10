import ParentChildrenYansiList from '@/components/mirror/ayna/ParentChildrenYansiList';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MirrorChildrenPage({ params }: PageProps) {
  const { slug } = await params;
  return <ParentChildrenYansiList parentSlug={decodeURIComponent(slug)} />;
}
