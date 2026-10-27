'use client';

import { useState } from 'react';
import type { GetJokesPart } from '@/tools';
import type { JokeItem } from '@/tools/get-jokes';
import { ToolError, ToolLoading } from './ToolStatus';

export default function JokeList({ part }: { part: GetJokesPart }) {
  if (part.state === 'output-error') return <ToolError message={part.errorText} />;
  if (part.state !== 'output-available') return <ToolLoading label="Fetching jokes..." />;

  const result = part.output;
  const heading =
    result.action === 'search'
      ? `Jokes about "${result.keyword}" (showing ${result.jokes.length} of ${result.total})`
      : `A ${result.category} joke`;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{heading}</span>
        <span className="rounded-full bg-white px-2 py-0.5">
          {result.source === 'api' ? 'from icanhazdadjoke.com' : 'from the local database'}
        </span>
      </div>

      {result.jokes.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
          No jokes found for that keyword.
        </p>
      )}

      {result.jokes.map(joke => (
        <JokeCard key={joke.id} joke={joke} />
      ))}

      {result.note && <p className="text-xs text-amber-700">{result.note}</p>}
    </div>
  );
}

function JokeCard({ joke }: { joke: JokeItem }) {
  const [votes, setVotes] = useState({ up: joke.thumbsUp, down: joke.thumbsDown });
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState('');

  const rate = async (vote: 'up' | 'down') => {
    setVoted(true);
    setError('');
    try {
      const response = await fetch('/api/jokes/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: joke.id, vote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVotes({ up: data.thumbsUp, down: data.thumbsDown });
    } catch (error) {
      setVoted(false);
      setError(error instanceof Error && error.message ? error.message : 'Could not save your rating.');
    }
  };

  return (
    <figure className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <blockquote className="whitespace-pre-line text-base font-medium text-amber-900">{joke.joke}</blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => rate('up')}
          disabled={voted}
          aria-label="Thumbs up"
          className="rounded-full border border-amber-300 bg-white px-3 py-1 hover:bg-amber-100 disabled:opacity-60"
        >
          👍 {votes.up}
        </button>
        <button
          onClick={() => rate('down')}
          disabled={voted}
          aria-label="Thumbs down"
          className="rounded-full border border-amber-300 bg-white px-3 py-1 hover:bg-amber-100 disabled:opacity-60"
        >
          👎 {votes.down}
        </button>
        {voted && !error && <span className="text-xs text-amber-700">Thanks for rating!</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </figcaption>
    </figure>
  );
}
