import { streamText } from 'ai';
import { openrouter } from './openrouter';
import type { Source } from '../types';

export const MAX_SPEECH_LENGTH = 2500;

const system = `You write the script for a one-minute podcast episode read by a single narrator.

- Write about 150 words of plain spoken text in short paragraphs.
- Open with one welcoming line that names the document, cover its most important ideas, and end with a short sign-off.
- Use only facts from the sources. Do not add outside knowledge.
- After each sentence that uses a source, add the page it came from in square brackets, like [p. 2].
- No headings, lists, markdown, speaker labels or stage directions.`;

export function streamPodcastScript({
  title,
  sources,
  onFinish,
}: {
  title: string;
  sources: Source[];
  onFinish?: (script: string) => Promise<void>;
}) {
  const context = sources
    .map((source, index) => `[Source ${index + 1}, page ${source.page}]\n${source.content}`)
    .join('\n\n');

  return streamText({
    model: openrouter.chat('openai/gpt-5-mini'),
    system,
    prompt: `Document: ${title}\n\nSources:\n${context}`,
    maxOutputTokens: 4000,
    onFinish: async ({ text, finishReason }) => {
      if (finishReason === 'stop' && text.trim()) {
        await onFinish?.(text.trim());
      }
    },
  });
}

export function scriptForSpeech(script: string): string {
  return script.replace(/\s*\[pp?\.[^\]]*\]/g, '').trim();
}
