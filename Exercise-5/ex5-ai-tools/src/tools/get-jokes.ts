import { tool } from 'ai';
import { z } from 'zod';
import { CircuitBreaker } from '@/lib/circuit-breaker';
import { JOKE_CATEGORIES, type JokeCategory } from '@/lib/constants';
import { connectToDatabase } from '@/lib/db';
import { FriendlyError } from '@/lib/errors';
import { fetchWithRetry } from '@/lib/http';
import { Joke, type JokeRecord } from '@/lib/models';
import { getSettings } from '@/lib/settings';
import { trackUsage } from '@/lib/usage';

const JOKES_URL = 'https://icanhazdadjoke.com';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ex5-ai-tools (AI SDK course exercise, local learning app)',
};
const PROGRAMMING_TERMS = ['computer', 'keyboard', 'internet', 'developer', 'email', 'data'];
const OFFLINE_NOTE = 'The joke API is not reachable, so this comes from the local joke database.';

export const jokesBreaker = new CircuitBreaker('icanhazdadjoke');

const jokesInputSchema = z.object({
  action: z
    .enum(['random', 'search'])
    .default('random')
    .describe('random tells a new joke, search finds jokes that contain a keyword'),
  category: z
    .enum(JOKE_CATEGORIES)
    .optional()
    .describe('dad, programming or general. Leave empty to use the saved preference'),
  keyword: z.string().trim().min(2).max(40).optional().describe('Keyword to search for when action is search'),
});

type JokesInput = z.infer<typeof jokesInputSchema>;

export type JokeItem = { id: string; joke: string; thumbsUp: number; thumbsDown: number };

type JokesResult = {
  action: 'random' | 'search';
  category: JokeCategory | null;
  keyword: string | null;
  source: 'api' | 'database';
  total: number;
  jokes: JokeItem[];
  note: string | null;
};

type ApiJoke = { id: string; joke: string };
type StoredJoke = JokeRecord & { _id: unknown };

function toItem(joke: StoredJoke): JokeItem {
  return { id: String(joke._id), joke: joke.joke, thumbsUp: joke.thumbsUp, thumbsDown: joke.thumbsDown };
}

async function callJokesApi<T>(path: string) {
  return jokesBreaker.run(async () => {
    const response = await fetchWithRetry(`${JOKES_URL}${path}`, { headers: HEADERS });
    if (!response.ok) throw new Error(`icanhazdadjoke answered with status ${response.status}`);
    return (await response.json()) as T;
  });
}

async function saveJokes(apiJokes: ApiJoke[], category: JokeCategory) {
  if (apiJokes.length === 0) return [];

  await Joke.bulkWrite(
    apiJokes.map(joke => ({
      updateOne: {
        filter: { jokeId: joke.id },
        update: { $setOnInsert: { joke: joke.joke, category } },
        upsert: true,
      },
    })),
  );

  return Joke.find({ jokeId: { $in: apiJokes.map(joke => joke.id) } }).lean();
}

async function randomFromApi(category: JokeCategory) {
  if (category === 'programming') {
    const term = PROGRAMMING_TERMS[Math.floor(Math.random() * PROGRAMMING_TERMS.length)];
    const data = await callJokesApi<{ results: ApiJoke[] }>(`/search?term=${term}&limit=30`);
    return data.results;
  }

  return [await callJokesApi<ApiJoke>('/')];
}

async function randomJoke(category: JokeCategory): Promise<JokesResult> {
  const result = { action: 'random' as const, category, keyword: null, total: 1 };

  try {
    const saved = await saveJokes(await randomFromApi(category), category);
    if (saved.length === 0) throw new Error('The joke API returned no jokes');
    const joke = saved[Math.floor(Math.random() * saved.length)];
    return { ...result, source: 'api', jokes: [toItem(joke)], note: null };
  } catch (error) {
    console.error('[getJokes]', error);
    const [joke] = await Joke.aggregate<StoredJoke>([{ $match: { category } }, { $sample: { size: 1 } }]);
    if (!joke) {
      throw new FriendlyError('The joke API is not reachable and there are no saved jokes in this category yet.');
    }
    return { ...result, source: 'database', jokes: [toItem(joke)], note: OFFLINE_NOTE };
  }
}

async function searchJokes(keyword: string): Promise<JokesResult> {
  const result = { action: 'search' as const, category: null, keyword };

  try {
    const data = await callJokesApi<{ results: ApiJoke[]; total_jokes: number }>(
      `/search?term=${encodeURIComponent(keyword)}&limit=5`,
    );
    const saved = await saveJokes(data.results, 'general');
    return { ...result, source: 'api', total: data.total_jokes, jokes: saved.map(toItem), note: null };
  } catch (error) {
    console.error('[getJokes]', error);
    const jokes = await Joke.find({ $text: { $search: keyword } }).limit(5).lean();
    return { ...result, source: 'database', total: jokes.length, jokes: jokes.map(toItem), note: OFFLINE_NOTE };
  }
}

export async function fetchJokes(input: JokesInput): Promise<JokesResult> {
  if (input.action === 'search' && !input.keyword) {
    throw new FriendlyError('Tell me a keyword to search for, for example "cat".');
  }

  await connectToDatabase();
  if (input.action === 'search' && input.keyword) return searchJokes(input.keyword);

  const category = input.category ?? (await getSettings()).jokeCategory;
  return randomJoke(category);
}

export async function rateJoke(id: string, vote: 'up' | 'down') {
  await connectToDatabase();
  const joke = await Joke.findByIdAndUpdate(
    id,
    { $inc: vote === 'up' ? { thumbsUp: 1 } : { thumbsDown: 1 } },
    { returnDocument: 'after' },
  ).lean();

  return joke ? toItem(joke) : null;
}

export const getJokes = tool({
  description:
    'Tell jokes from icanhazdadjoke.com. Use action random with a category (dad, programming or general) ' +
    'for a new joke, or action search with a keyword to find jokes about a topic.',
  inputSchema: jokesInputSchema,
  execute: async input => trackUsage('getJokes', () => fetchJokes(input)),
});
