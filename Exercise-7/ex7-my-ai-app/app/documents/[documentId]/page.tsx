import { redirect } from 'next/navigation';
import { PodcastStudio } from '@/components/podcast-studio';
import { getDocument } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ documentId: string }>;
}

export default async function StudioPage({ params }: PageProps) {
  const { documentId } = await params;
  const document = await getDocument(documentId);

  if (!document) {
    redirect('/');
  }

  return <PodcastStudio documentId={document.documentId} title={document.title} />;
}
