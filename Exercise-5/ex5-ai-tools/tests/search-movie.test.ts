import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MovieCache } from '@/lib/models';
import { findMovie, omdbBreaker } from '@/tools/search-movie';
import { closeTestDatabase, failingFetch, jsonResponse, mockFetch, setupTestDatabase } from './helpers';

const inception = {
  Response: 'True',
  Title: 'Inception',
  Year: '2010',
  Rated: 'PG-13',
  Released: '16 Jul 2010',
  Runtime: '148 min',
  Genre: 'Action, Adventure, Sci-Fi',
  Director: 'Christopher Nolan',
  Actors: 'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page',
  Plot: 'A thief who steals corporate secrets through dream-sharing technology is given a final job.',
  Poster: 'https://m.media-amazon.com/images/M/inception.jpg',
  imdbRating: '8.8',
  imdbID: 'tt1375666',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '8.8/10' },
    { Source: 'Rotten Tomatoes', Value: '87%' },
    { Source: 'Metacritic', Value: '74/100' },
  ],
};

const matrix = { ...inception, Title: 'The Matrix', Year: '1999', imdbID: 'tt0133093', Poster: 'N/A' };
const notFound = { Response: 'False', Error: 'Movie not found!' };

describe('searchMovie tool', () => {
  beforeAll(setupTestDatabase);
  afterAll(closeTestDatabase);

  beforeEach(async () => {
    process.env.OMDB_API_KEY = 'test-omdb-key';
    omdbBreaker.reset();
    await MovieCache.deleteMany({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns plot, cast, ratings, poster and runtime from OMDb', async () => {
    const fetch = mockFetch(() => jsonResponse(inception));

    const result = await findMovie({ title: 'Inception', year: 2010 });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.source).toBe('omdb');
    expect(result.movie).toMatchObject({
      title: 'Inception',
      runtime: '148 min',
      cast: 'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page',
      poster: 'https://m.media-amazon.com/images/M/inception.jpg',
      imdbRating: '8.8',
    });
    expect(result.movie.plot).toContain('dream-sharing');
    expect(result.movie.ratings).toHaveLength(3);

    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.searchParams.get('t')).toBe('Inception');
    expect(url.searchParams.get('y')).toBe('2010');
    expect(url.searchParams.get('apikey')).toBe('test-omdb-key');
  });

  it('recommends local movies by genre and year', async () => {
    mockFetch(() => jsonResponse(inception));

    const result = await findMovie({ title: 'Inception' });

    if (!result.found) throw new Error('expected a movie');
    expect(result.recommendations.map(movie => movie.title)).toEqual([
      'The Dark Knight',
      'Interstellar',
      'Ex Machina',
    ]);
  });

  it('serves a repeated search from the MongoDB cache', async () => {
    const fetch = mockFetch(() => jsonResponse(inception));

    await findMovie({ title: 'Inception' });
    const second = await findMovie({ title: 'inception' });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second.found && second.source).toBe('cache');
    expect(await MovieCache.countDocuments()).toBe(1);
  });

  it('matches partial titles through the search endpoint', async () => {
    const fetch = mockFetch(url => {
      const params = new URL(url).searchParams;
      if (params.get('t')) return jsonResponse(notFound);
      if (params.get('s')) {
        return jsonResponse({
          Response: 'True',
          Search: [
            { Title: 'The Matrix', Year: '1999', imdbID: 'tt0133093' },
            { Title: 'The Matrix Reloaded', Year: '2003', imdbID: 'tt0234215' },
          ],
        });
      }
      return jsonResponse(matrix);
    });

    const result = await findMovie({ title: 'matri' });

    expect(fetch).toHaveBeenCalledTimes(3);
    if (!result.found) throw new Error('expected a movie');
    expect(result.movie.title).toBe('The Matrix');
    expect(result.movie.poster).toBeNull();
    expect(result.otherMatches).toEqual([{ title: 'The Matrix Reloaded', year: '2003', imdbId: 'tt0234215' }]);
  });

  it('shows a clear message when no movie matches', async () => {
    mockFetch(() => jsonResponse(notFound));

    const result = await findMovie({ title: 'Qwertyuiop Zxcv' });

    expect(result).toEqual({
      found: false,
      title: 'Qwertyuiop Zxcv',
      message: 'No movie matching "Qwertyuiop Zxcv" was found on OMDb. Check the spelling or try another title.',
    });
  });

  it('returns a friendly error when the OMDb key is missing', async () => {
    process.env.OMDB_API_KEY = '';
    const fetch = mockFetch(() => jsonResponse(inception));

    await expect(findMovie({ title: 'Inception' })).rejects.toThrow('Movie search needs an OMDb API key');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explains when OMDb rejects the key', async () => {
    mockFetch(() => jsonResponse({ Response: 'False', Error: 'Invalid API key!' }, 401));

    await expect(findMovie({ title: 'Inception' })).rejects.toThrow('OMDb did not accept the API key');
  });

  it('retries and then falls back to the local database when OMDb is down', async () => {
    const fetch = failingFetch();

    const result = await findMovie({ title: 'Inception' });

    expect(fetch).toHaveBeenCalledTimes(3);
    if (!result.found) throw new Error('expected a movie');
    expect(result.source).toBe('local');
    expect(result.note).toContain('OMDb is not responding');
    expect(result.movie).toMatchObject({ title: 'Inception', year: '2010', director: 'Christopher Nolan' });
  });

  it('falls back when the OMDb daily limit is reached', async () => {
    mockFetch(() => jsonResponse({ Response: 'False', Error: 'Request limit reached!' }, 401));

    const result = await findMovie({ title: 'The Godfather' });

    if (!result.found) throw new Error('expected a movie');
    expect(result.source).toBe('local');
    expect(result.note).toContain('daily limit');
  });

  it('gives a friendly error when OMDb is down and the movie is not stored locally', async () => {
    failingFetch();

    await expect(findMovie({ title: 'Paddington' })).rejects.toThrow('OMDb is not responding right now');
  });

  it('stops calling OMDb after repeated failures', async () => {
    const fetch = failingFetch();

    await findMovie({ title: 'Matrix' });
    await findMovie({ title: 'Matrix' });
    await findMovie({ title: 'Matrix' });
    const callsBefore = fetch.mock.calls.length;
    const result = await findMovie({ title: 'Matrix' });

    expect(fetch.mock.calls.length).toBe(callsBefore);
    expect(result.found && result.note).toContain('paused');
  });
});
