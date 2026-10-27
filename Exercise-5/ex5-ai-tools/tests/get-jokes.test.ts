import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as rate } from '@/app/api/jokes/rate/route';
import { Joke } from '@/lib/models';
import { updateSettings } from '@/lib/settings';
import { fetchJokes, jokesBreaker } from '@/tools/get-jokes';
import { closeTestDatabase, failingFetch, jsonResponse, mockFetch, postJson, setupTestDatabase } from './helpers';

describe('getJokes tool', () => {
  beforeAll(setupTestDatabase);
  afterAll(closeTestDatabase);

  beforeEach(() => {
    jokesBreaker.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a random dad joke from the API and stores it for offline use', async () => {
    const fetch = mockFetch(() => jsonResponse({ id: 'api-dad-1', joke: 'I only know 25 letters. I do not know y.', status: 200 }));

    const result = await fetchJokes({ action: 'random', category: 'dad' });

    expect(result.source).toBe('api');
    expect(result.jokes[0]).toMatchObject({ joke: 'I only know 25 letters. I do not know y.', thumbsUp: 0 });
    expect(fetch.mock.calls[0][0]).toBe('https://icanhazdadjoke.com/');
    const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json');
    expect(headers['User-Agent']).toContain('ex5-ai-tools');
    expect(await Joke.findOne({ jokeId: 'api-dad-1' }).lean()).toMatchObject({ category: 'dad' });
  });

  it('uses the search endpoint with a computer term for programming jokes and stores the whole batch', async () => {
    const fetch = mockFetch(() =>
      jsonResponse({
        results: [
          { id: 'api-prog-1', joke: 'My computer froze, I left too many windows open.' },
          { id: 'api-prog-2', joke: 'I was fired from the keyboard factory for not putting in enough shifts.' },
        ],
        total_jokes: 2,
      }),
    );

    const result = await fetchJokes({ action: 'random', category: 'programming' });

    expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/icanhazdadjoke\.com\/search\?term=\w+&limit=30$/);
    expect(result.jokes).toHaveLength(1);
    expect(await Joke.countDocuments({ jokeId: { $in: ['api-prog-1', 'api-prog-2'] }, category: 'programming' })).toBe(2);
  });

  it('falls back to a stored joke when the API is unreachable', async () => {
    const fetch = failingFetch();

    const result = await fetchJokes({ action: 'random', category: 'general' });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.source).toBe('database');
    expect(result.note).toContain('not reachable');
    const stored = await Joke.findById(result.jokes[0].id).lean();
    expect(stored?.category).toBe('general');
  });

  it('uses the saved default category when none is given', async () => {
    failingFetch();
    await updateSettings({ jokeCategory: 'programming' });

    const result = await fetchJokes({ action: 'random' });
    await updateSettings({ jokeCategory: 'dad' });

    expect(result.category).toBe('programming');
  });

  it('searches jokes by keyword through the API', async () => {
    const fetch = mockFetch(() =>
      jsonResponse({
        results: [
          { id: 'api-cat-1', joke: 'What do you call a pile of cats? A meowntain.' },
          { id: 'api-cat-2', joke: 'Cats have nine lives, which makes them purr-fect for horror movies.' },
        ],
        total_jokes: 12,
      }),
    );

    const result = await fetchJokes({ action: 'search', keyword: 'cat' });

    expect(fetch.mock.calls[0][0]).toBe('https://icanhazdadjoke.com/search?term=cat&limit=5');
    expect(result).toMatchObject({ action: 'search', keyword: 'cat', source: 'api', total: 12 });
    expect(result.jokes).toHaveLength(2);
  });

  it('searches the local database when the API is down', async () => {
    failingFetch();

    const result = await fetchJokes({ action: 'search', keyword: 'computer' });

    expect(result.source).toBe('database');
    expect(result.jokes.length).toBeGreaterThan(0);
    expect(result.jokes.every(joke => joke.joke.toLowerCase().includes('computer'))).toBe(true);
  });

  it('asks for a keyword before searching', async () => {
    await expect(fetchJokes({ action: 'search' })).rejects.toThrow('Tell me a keyword');
  });

  it('rates jokes with thumbs up and thumbs down', async () => {
    const joke = await Joke.findOne({ jokeId: 'local-1' }).lean();
    const id = String(joke?._id);

    await rate(postJson('http://localhost/api/jokes/rate', { id, vote: 'up' }));
    await rate(postJson('http://localhost/api/jokes/rate', { id, vote: 'up' }));
    const response = await rate(postJson('http://localhost/api/jokes/rate', { id, vote: 'down' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, thumbsUp: 2, thumbsDown: 1 });
  });

  it('rejects bad ratings', async () => {
    const invalid = await rate(postJson('http://localhost/api/jokes/rate', { id: 'abc', vote: 'up' }));
    const missing = await rate(postJson('http://localhost/api/jokes/rate', { id: '64b7f0c2a1b2c3d4e5f60718', vote: 'down' }));
    const wrongVote = await rate(postJson('http://localhost/api/jokes/rate', { id: '64b7f0c2a1b2c3d4e5f60718', vote: 'meh' }));

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(wrongVote.status).toBe(400);
  });
});
