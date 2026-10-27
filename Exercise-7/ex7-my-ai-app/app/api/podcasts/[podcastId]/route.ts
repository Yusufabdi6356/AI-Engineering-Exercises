import { NextResponse } from 'next/server';
import { deletePodcast, getPodcast } from '@/lib/mongodb';
import { deleteAudio } from '@/lib/audio';

interface RouteContext {
  params: Promise<{ podcastId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { podcastId } = await params;

  try {
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, podcast });
  } catch (error) {
    console.error('Loading the episode failed:', error);
    return NextResponse.json({ error: 'Could not load this episode' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { podcastId } = await params;

  try {
    const podcast = await getPodcast(podcastId);
    if (!podcast) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    await deleteAudio(podcast.podcastId);
    await deletePodcast(podcast.podcastId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deleting the episode failed:', error);
    return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 });
  }
}
