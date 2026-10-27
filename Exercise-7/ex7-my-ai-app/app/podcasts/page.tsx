'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Headphones, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeError, errorMessage, formatDate } from '@/lib/utils';
import type { PodcastItem } from '@/lib/types';

export default function EpisodesPage() {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPodcasts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/podcasts');
      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Could not load your episodes.'));
      }
      const data = await response.json();
      setPodcasts(data.podcasts);
    } catch (error) {
      setError(describeError(error, 'Could not load your episodes.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPodcasts();
  }, [fetchPodcasts]);

  const handleDelete = async (podcastId: string) => {
    if (deletingId) return;
    setDeletingId(podcastId);

    try {
      const response = await fetch(`/api/podcasts/${podcastId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await errorMessage(response, 'Failed to delete episode'));
      }
      setPodcasts((prev) => prev.filter((podcast) => podcast.podcastId !== podcastId));
      toast.success('Episode deleted');
    } catch (error) {
      toast.error(describeError(error, 'Failed to delete episode'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Episodes
          <Badge variant="secondary">{podcasts.length}</Badge>
        </CardTitle>
        <CardDescription>Every episode you have made, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading episodes...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Could not load your episodes</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchPodcasts}>
                <RotateCcw />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : podcasts.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Headphones className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium text-foreground">No episodes yet</p>
            <p className="mb-4 text-sm">Pick a document in your library to make your first one.</p>
            <Button variant="outline" asChild>
              <Link href="/">Go to library</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {podcasts.map((podcast) => (
              <li key={podcast.podcastId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{podcast.documentTitle}</p>
                    <Badge variant={podcast.hasAudio ? 'default' : 'outline'}>
                      {podcast.hasAudio ? 'Audio ready' : 'No audio yet'}
                    </Badge>
                  </div>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{podcast.script}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(podcast.createdAt)}, {podcast.sources.length} sources
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/podcasts/${podcast.podcastId}`}>Open</Link>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete episode about ${podcast.documentTitle}`}
                    onClick={() => handleDelete(podcast.podcastId)}
                    disabled={deletingId === podcast.podcastId}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === podcast.podcastId ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
