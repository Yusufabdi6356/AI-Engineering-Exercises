import Image from 'next/image';
import type { SearchMoviePart } from '@/tools';
import { ToolError, ToolLoading } from './ToolStatus';

export default function MovieCard({ part }: { part: SearchMoviePart }) {
  if (part.state === 'output-error') return <ToolError message={part.errorText} />;
  if (part.state !== 'output-available') return <ToolLoading label="Looking up the movie..." />;

  const result = part.output;
  if (!result.found) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {result.message}
      </div>
    );
  }

  const { movie } = result;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        {movie.poster ? (
          <Image
            src={movie.poster}
            alt={`${movie.title} poster`}
            width={160}
            height={237}
            loading="lazy"
            className="h-auto w-32 self-start rounded sm:w-40"
          />
        ) : (
          <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
            No poster
          </div>
        )}

        <div className="flex-1 space-y-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {movie.title} <span className="font-normal text-gray-500">({movie.year})</span>
            </h3>
            <p className="text-xs text-gray-500">{[movie.rated, movie.genre].filter(Boolean).join(' · ')}</p>
          </div>

          {movie.plot && <p className="text-gray-700">{movie.plot}</p>}

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-gray-700">
            <dt className="font-medium text-gray-500">Runtime</dt>
            <dd>{movie.runtime ?? 'Not available'}</dd>
            <dt className="font-medium text-gray-500">Director</dt>
            <dd>{movie.director ?? 'Not available'}</dd>
            <dt className="font-medium text-gray-500">Cast</dt>
            <dd>{movie.cast ?? 'Not available'}</dd>
          </dl>

          <div className="flex flex-wrap gap-2">
            {movie.imdbRating && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                IMDb {movie.imdbRating}/10
              </span>
            )}
            {movie.ratings
              .filter(rating => rating.source !== 'Internet Movie Database')
              .map(rating => (
                <span key={rating.source} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {rating.source} {rating.value}
                </span>
              ))}
          </div>
        </div>
      </div>

      {result.otherMatches.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Other matches: {result.otherMatches.map(match => `${match.title} (${match.year})`).join(', ')}
        </p>
      )}

      {result.recommendations.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="text-xs font-semibold text-gray-700">You might also like</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {result.recommendations.map(movie => (
              <li key={movie.title} className="rounded border px-2 py-1 text-xs text-gray-700">
                {movie.title} ({movie.year}) · {movie.genre} · {movie.rating}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400">
        {result.note ?? (result.source === 'cache' ? 'Loaded from the movie cache.' : 'Loaded from OMDb.')}
      </p>
    </div>
  );
}
