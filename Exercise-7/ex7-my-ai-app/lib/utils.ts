export { cn } from 'cn';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export async function errorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return data?.error ?? fallback;
}

export async function recordAudio(podcastId: string): Promise<void> {
  const response = await fetch(`/api/podcasts/${podcastId}/audio`, { method: 'POST' });

  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Could not record the audio. Please try again.'));
  }
}

export function describeError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return 'Could not reach the app server. Check that it is running, then try again.';
  }
  return error instanceof Error ? error.message : fallback;
}
