import { redirect } from 'next/navigation';
import { EpisodeView } from '@/components/episode-view';
import { getPodcast } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ podcastId: string }>;
}

export default async function EpisodePage({ params }: PageProps) {
  const { podcastId } = await params;
  const podcast = await getPodcast(podcastId);

  if (!podcast) {
    redirect('/podcasts');
  }

  return <EpisodeView podcast={podcast} />;
}
