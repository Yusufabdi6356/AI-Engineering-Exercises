'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Streamdown } from 'streamdown';
import { AlertCircle, Loader2, Mic, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SourcesList } from '@/components/sources-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeError, errorMessage, formatDate, recordAudio } from '@/lib/utils';
import type { PodcastItem } from '@/lib/types';

export function EpisodeView({ podcast }: { podcast: PodcastItem }) {
  const router = useRouter();
  const [hasAudio, setHasAudio] = useState(podcast.hasAudio);
  const [recording, setRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const makeAudio = async () => {
    setRecording(true);
    setAudioError(null);

    try {
      await recordAudio(podcast.podcastId);
      setHasAudio(true);
      toast.success('Audio recorded');
    } catch (error) {
      setAudioError(describeError(error, 'Could not record the audio.'));
    } finally {
      setRecording(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const response = await fetch(`/api/podcasts/${podcast.podcastId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Failed to delete episode'));
      }
      toast.success('Episode deleted');
      router.push('/podcasts');
    } catch (error) {
      toast.error(describeError(error, 'Failed to delete episode'));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{podcast.documentTitle}</CardTitle>
          <CardDescription>Episode made {formatDate(podcast.createdAt)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasAudio ? (
            <audio controls className="w-full" src={`/api/podcasts/${podcast.podcastId}/audio`} />
          ) : (
            <Button onClick={makeAudio} disabled={recording}>
              {recording ? <Loader2 className="animate-spin" /> : <Mic />}
              {recording ? 'Recording the narration...' : 'Record audio'}
            </Button>
          )}
          {audioError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not record the audio</AlertTitle>
              <AlertDescription>{audioError}</AlertDescription>
            </Alert>
          )}
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-muted-foreground hover:text-destructive"
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete episode
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Script</CardTitle>
          <CardDescription>Page numbers in brackets show where each fact came from.</CardDescription>
        </CardHeader>
        <CardContent>
          <Streamdown className="space-y-3 leading-relaxed">{podcast.script}</Streamdown>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Retrieved from Pinecone and reranked with Cohere.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourcesList sources={podcast.sources} />
        </CardContent>
      </Card>
    </div>
  );
}
