import AuthorPublishedYansiProfile from '@/components/mirror/ayna/AuthorPublishedYansiProfile';

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AuthorPublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  return <AuthorPublishedYansiProfile userId={decodeURIComponent(userId)} />;
}
