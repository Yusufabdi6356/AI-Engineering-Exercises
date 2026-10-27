import { NextResponse } from 'next/server';
import { getPodcast, markPodcastAudio } from '@/lib/mongodb';
import { readAudio, saveAudio } from '@/lib/audio';
import { createSpeech } from '@/lib/ai/speech';
import { MAX_SPEECH_LENGTH, scriptForSpeech } from '@/lib/ai/script';
import { missingKeys } from '@/lib/env';

export const maxDuration = 120;

const recording = new Set<string>();

interface RouteContext {
  params: Promise<{ podcastId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { podcastId } = await params;
  const podcast = await getPodcast(podcastId).catch(() => null);
  const audio = podcast?.hasAudio ? await readAudio(podcast.podcastId) : null;

  if (!audio) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }

  return new Response(new Uint8Array(audio), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
    },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const missing = missingKeys(['OPENROUTER_API_KEY'], 'record audio');
  if (missing) {
    return NextResponse.json({ error: missing }, { status: 503 });
  }

  const { podcastId } = await params;
  const podcast = await getPodcast(podcastId);

  if (!podcast) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  if (podcast.hasAudio) {
    return NextResponse.json({ success: true });
  }

  const text = scriptForSpeech(podcast.script);
  if (text.length > MAX_SPEECH_LENGTH) {
    return NextResponse.json(
      { error: 'This script is too long to record. Make a new episode and try again.' },
      { status: 400 }
    );
  }

  if (recording.has(podcast.podcastId)) {
    return NextResponse.json({ error: 'This episode is already being recorded.' }, { status: 409 });
  }

  recording.add(podcast.podcastId);

  try {
    await saveAudio(podcast.podcastId, await createSpeech(text));
    await markPodcastAudio(podcast.podcastId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recording audio failed:', error);
    return NextResponse.json(
      { error: 'Could not record the audio. Check OPENROUTER_API_KEY and your OpenRouter credit, then try again.' },
      { status: 500 }
    );
  } finally {
    recording.delete(podcast.podcastId);
  }
}
