'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Streamdown } from 'streamdown';
import { AlertCircle, Loader2, Mic, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { SourcesList } from '@/components/sources-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeError, errorMessage, recordAudio } from '@/lib/utils';
import type { PodcastItem } from '@/lib/types';

type Status = 'idle' | 'writing' | 'recording' | 'done' | 'error';

interface PodcastStudioProps {
  documentId: string;
  title: string;
}

export function PodcastStudio({ documentId, title }: PodcastStudioProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [script, setScript] = useState('');
  const [podcast, setPodcast] = useState<PodcastItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const busy = status === 'writing' || status === 'recording';

  const makeAudio = async (podcastId: string) => {
    setStatus('recording');
    setAudioError(null);

    try {
      await recordAudio(podcastId);
      setStatus('done');
      toast.success('Your episode is ready');
    } catch (error) {
      setAudioError(describeError(error, 'Could not record the audio.'));
      setStatus('done');
    }
  };

  const generate = async () => {
    setStatus('writing');
    setScript('');
    setPodcast(null);
    setError(null);
    setAudioError(null);

    try {
      const response = await fetch('/api/podcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await errorMessage(response, 'Could not write the script. Please try again.'));
      }

      const podcastId = response.headers.get('X-Podcast-Id');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setScript((prev) => prev + text);
      }

      const saved = await fetch(`/api/podcasts/${podcastId}`);
      if (!saved.ok) {
        throw new Error('The script could not be written. Check OPENROUTER_API_KEY and your OpenRouter credit, then try again.');
      }

      const data = await saved.json();
      setPodcast(data.podcast);
      await makeAudio(data.podcast.podcastId);
    } catch (error) {
      const message = describeError(error, 'Could not write the script. Please try again.');
      setScript('');
      setError(message);
      setStatus('error');
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>
            The app finds the most important passages in this PDF, reranks them, and writes a one-minute episode
            that cites its pages. Then a narrator reads it aloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy}>
            {status === 'writing' ? <Loader2 className="animate-spin" /> : <Mic />}
            {status === 'writing' ? 'Writing script...' : podcast ? 'Make a new episode' : 'Make episode'}
          </Button>
          {status === 'writing' && !script && (
            <span className="text-sm text-muted-foreground">Finding sources and starting the script...</span>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not make the episode</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={generate}>
              <RotateCcw />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {script && (
        <Card>
          <CardHeader>
            <CardTitle>Script</CardTitle>
            <CardDescription>Page numbers in brackets show where each fact came from.</CardDescription>
          </CardHeader>
          <CardContent>
            <Streamdown className="space-y-3 leading-relaxed" parseIncompleteMarkdown>
              {script}
            </Streamdown>
          </CardContent>
        </Card>
      )}

      {podcast && (
        <Card>
          <CardHeader>
            <CardTitle>Audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === 'recording' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Recording the narration. This can take up to a minute...
              </div>
            )}
            {status === 'done' && !audioError && (
              <audio controls className="w-full" src={`/api/podcasts/${podcast.podcastId}/audio`} />
            )}
            {audioError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>The script is saved, but the audio failed</AlertTitle>
                <AlertDescription>
                  <p>{audioError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => makeAudio(podcast.podcastId)}>
                    <RotateCcw />
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {status === 'done' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/podcasts/${podcast.podcastId}`}>Open episode page</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {podcast && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Retrieved from Pinecone and reranked with Cohere.</CardDescription>
          </CardHeader>
          <CardContent>
            <SourcesList sources={podcast.sources} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
