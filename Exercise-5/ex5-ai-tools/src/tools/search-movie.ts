import { tool } from 'ai';
import { z } from 'zod';
import { CircuitBreaker, CircuitOpenError } from '@/lib/circuit-breaker';
import { connectToDatabase } from '@/lib/db';
import { FriendlyError } from '@/lib/errors';
import { fetchWithRetry } from '@/lib/http';
import { Movie, MovieCache } from '@/lib/models';
import { escapeRegex } from '@/lib/regex';
import { trackUsage } from '@/lib/usage';

const OMDB_URL = 'https://www.omdbapi.com/';

export const omdbBreaker = new CircuitBreaker('OMDb');

const movieInputSchema = z.object({
  title: z.string().trim().min(1).max(100).describe('Full or partial movie title'),
  year: z.number().int().min(1888).max(2100).optional().describe('Release year, only if the user gave one'),
});

type MovieInput = z.infer<typeof movieInputSchema>;

type MovieDetails = {
  imdbId: string | null;
  title: string;
  year: string;
  rated: string | null;
  released: string | null;
  runtime: string | null;
  genre: string | null;
  director: string | null;
  cast: string | null;
  plot: string | null;
  poster: string | null;
  imdbRating: string | null;
  ratings: { source: string; value: string }[];
};

type Match = { title: string; year: string; imdbId: string };
type Recommendation = { title: string; year: number; genre: string; rating: number };
type FetchedMovie = { movie: MovieDetails; otherMatches: Match[] };

type MovieResult =
  | {
      found: true;
      source: 'omdb' | 'cache' | 'local';
      movie: MovieDetails;
      otherMatches: Match[];
      recommendations: Recommendation[];
      note: string | null;
    }
  | { found: false; title: string; message: string };

type OmdbError = { Response: 'False'; Error: string };
type OmdbMovie = {
  Response: 'True';
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Actors: string;
  Plot: string;
  Poster: string;
  imdbRating: string;
  imdbID: string;
  Ratings?: { Source: string; Value: string }[];
};
type OmdbSearch = { Response: 'True'; Search: { Title: string; Year: string; imdbID: string }[] };

class OmdbLimitError extends Error {}

function present(value: string | undefined) {
  return value && value !== 'N/A' ? value : null;
}

function toDetails(data: OmdbMovie): MovieDetails {
  return {
    imdbId: data.imdbID,
    title: data.Title,
    year: data.Year,
    rated: present(data.Rated),
    released: present(data.Released),
    runtime: present(data.Runtime),
    genre: present(data.Genre),
    director: present(data.Director),
    cast: present(data.Actors),
    plot: present(data.Plot),
    poster: present(data.Poster),
    imdbRating: present(data.imdbRating),
    ratings: (data.Ratings ?? []).map(rating => ({ source: rating.Source, value: rating.Value })),
  };
}

async function callOmdb<T>(params: Record<string, string>, apiKey: string) {
  const url = `${OMDB_URL}?${new URLSearchParams({ ...params, apikey: apiKey })}`;

  return omdbBreaker.run(async () => {
    const response = await fetchWithRetry(url);
    const data = (await response.json()) as T | OmdbError;
    if ((data as OmdbError).Error === 'Request limit reached!') {
      throw new OmdbLimitError('OMDb request limit reached');
    }
    return data;
  });
}

function checkOmdbError(data: OmdbError) {
  if (data.Error === 'Invalid API key!' || data.Error === 'No API key provided.') {
    throw new FriendlyError('OMDb did not accept the API key. Check OMDB_API_KEY in .env.local and restart the app.');
  }
  if (data.Error !== 'Movie not found!' && data.Error !== 'Too many results.') {
    throw new Error(`OMDb answered: ${data.Error}`);
  }
}

async function fetchMovie(title: string, year: number | undefined, apiKey: string): Promise<FetchedMovie | null> {
  const yearParam: Record<string, string> = year ? { y: String(year) } : {};

  const exact = await callOmdb<OmdbMovie>({ t: title, type: 'movie', ...yearParam }, apiKey);
  if (exact.Response === 'True') return { movie: toDetails(exact), otherMatches: [] };
  checkOmdbError(exact);

  const search = await callOmdb<OmdbSearch>({ s: title, type: 'movie', ...yearParam }, apiKey);
  if (search.Response === 'False') {
    checkOmdbError(search);
    return null;
  }

  const [best, ...others] = search.Search;
  const details = await callOmdb<OmdbMovie>({ i: best.imdbID }, apiKey);
  if (details.Response === 'False') {
    checkOmdbError(details);
    return null;
  }

  return {
    movie: toDetails(details),
    otherMatches: others.slice(0, 5).map(match => ({ title: match.Title, year: match.Year, imdbId: match.imdbID })),
  };
}

async function recommend(movie: MovieDetails): Promise<Recommendation[]> {
  const genres = (movie.genre ?? '').split(',').map(genre => genre.trim()).filter(Boolean);
  const year = Number.parseInt(movie.year, 10);
  if (genres.length === 0 || Number.isNaN(year)) return [];

  return Movie.aggregate<Recommendation>([
    { $match: { genre: { $in: genres }, title: { $ne: movie.title } } },
    { $addFields: { yearGap: { $abs: { $subtract: ['$year', year] } } } },
    { $sort: { yearGap: 1, rating: -1 } },
    { $limit: 3 },
    { $project: { _id: 0, title: 1, year: 1, genre: 1, rating: 1 } },
  ]);
}

async function foundResult(
  source: 'omdb' | 'cache' | 'local',
  { movie, otherMatches }: FetchedMovie,
  note: string | null = null,
): Promise<MovieResult> {
  return { found: true, source, movie, otherMatches, recommendations: await recommend(movie), note };
}

function failureReason(error: unknown) {
  if (error instanceof OmdbLimitError) return 'The OMDb daily limit of 1,000 requests has been reached';
  if (error instanceof CircuitOpenError) return 'OMDb is paused for a short while after repeated failures';
  return 'OMDb is not responding right now';
}

async function localFallback(title: string, year: number | undefined, error: unknown): Promise<MovieResult> {
  const reason = failureReason(error);
  const local = await Movie.findOne({
    title: { $regex: escapeRegex(title), $options: 'i' },
    ...(year ? { year } : {}),
  }).lean();

  if (!local) {
    throw new FriendlyError(`${reason}, and "${title}" is not in the local database. Please try again later.`);
  }

  const movie: MovieDetails = {
    imdbId: null,
    title: local.title,
    year: String(local.year),
    rated: null,
    released: null,
    runtime: null,
    genre: local.genre,
    director: local.director,
    cast: null,
    plot: local.description,
    poster: null,
    imdbRating: String(local.rating),
    ratings: [],
  };

  return foundResult('local', { movie, otherMatches: [] }, `${reason}, so this comes from the local database.`);
}

export async function findMovie({ title, year }: MovieInput): Promise<MovieResult> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new FriendlyError(
      'Movie search needs an OMDb API key. Get a free key at https://www.omdbapi.com/apikey.aspx, ' +
        'add it to .env.local as OMDB_API_KEY and restart the app.',
    );
  }

  await connectToDatabase();
  const key = `${title.toLowerCase()}|${year ?? ''}`;
  const cached = await MovieCache.findOne({ key }).lean();
  if (cached) return foundResult('cache', cached.data);

  let fetched: FetchedMovie | null;
  try {
    fetched = await fetchMovie(title, year, apiKey);
  } catch (error) {
    if (error instanceof FriendlyError) throw error;
    console.error('[searchMovie]', error);
    return localFallback(title, year, error);
  }

  if (!fetched) {
    return {
      found: false,
      title,
      message: `No movie matching "${title}"${year ? ` from ${year}` : ''} was found on OMDb. Check the spelling or try another title.`,
    };
  }

  await MovieCache.updateOne({ key }, { $set: { data: fetched, createdAt: new Date() } }, { upsert: true });
  return foundResult('omdb', fetched);
}

export const searchMovie = tool({
  description:
    'Look up a movie on OMDb by full or partial title, with an optional year. ' +
    'Returns plot, cast, ratings, poster and runtime, plus similar movies from the local database by genre and year.',
  inputSchema: movieInputSchema,
  execute: async input => trackUsage('searchMovie', () => findMovie(input)),
});
