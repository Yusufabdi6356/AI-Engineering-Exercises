import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { saveConversation } from '@/lib/conversations';
import { Conversation, Joke, Movie, MovieCache, Review, User } from '@/lib/models';
import { getSettings, settingsInputSchema, updateSettings } from '@/lib/settings';
import { getToolStats, trackUsage } from '@/lib/usage';
import { closeTestDatabase, setupTestDatabase } from './helpers';

describe('database setup', () => {
  beforeAll(setupTestDatabase);
  afterAll(closeTestDatabase);

  it('seeds the sample movies, users, reviews and offline jokes', async () => {
    expect(await Movie.countDocuments()).toBe(36);
    expect(await User.countDocuments()).toBe(15);
    expect(await Review.countDocuments()).toBe(30);
    expect(await Joke.countDocuments({ jokeId: /^local-/ })).toBe(12);

    const review = await Review.findOne().populate<{ movie_id: { title: string } }>('movie_id').lean();
    expect(review?.movie_id.title).toBeTypeOf('string');
  });

  it('creates the indexes the tools rely on', async () => {
    const movieIndexes = (await Movie.listIndexes()).map(index => index.name);
    expect(movieIndexes).toEqual(expect.arrayContaining(['genre_1_rating_-1', 'rating_-1', 'year_1', 'title_1']));

    const userIndexes = await User.listIndexes();
    expect(userIndexes.find(index => index.name === 'email_1')?.unique).toBe(true);

    const jokeIndexes = (await Joke.listIndexes()).map(index => index.name);
    expect(jokeIndexes).toEqual(expect.arrayContaining(['jokeId_1', 'category_1', 'joke_text']));

    const cacheIndexes = await MovieCache.listIndexes();
    expect(cacheIndexes.find(index => index.name === 'createdAt_1')?.expireAfterSeconds).toBe(604800);
  });

  it('uses an index for genre queries', async () => {
    const plan = await Movie.find({ genre: 'Sci-Fi' }).sort({ rating: -1 }).explain('queryPlanner');
    const text = JSON.stringify(plan);

    expect(text).toContain('IXSCAN');
    expect(text).toContain('genre_1_rating_-1');
  });

  it('validates documents before saving them', async () => {
    const movie = { title: 'Test', year: 2020, genre: 'Drama', rating: 7, director: 'Someone', description: 'Test' };

    await expect(Movie.validate(movie)).resolves.toBeDefined();
    await expect(Movie.validate({ ...movie, rating: 11 })).rejects.toThrow('rating');
    await expect(Movie.validate({ ...movie, genre: 'Western' })).rejects.toThrow('genre');
    await expect(Movie.validate({ ...movie, year: 1500 })).rejects.toThrow('year');
    await expect(
      User.create({ name: 'Bad Email', email: 'not-an-email', age: 30, favorite_genre: 'Drama' }),
    ).rejects.toThrow('email');
    await expect(
      User.create({ name: 'Copy', email: 'ben.carter@example.com', age: 30, favorite_genre: 'Drama' }),
    ).rejects.toThrow('duplicate key');
    await expect(Review.create({ rating: 5, comment: 'No movie' })).rejects.toThrow('movie_id');
  });

  it('stores user settings with defaults and validation', async () => {
    expect(await getSettings()).toEqual({ jokeCategory: 'dad', pageSize: 10 });
    expect(await updateSettings({ jokeCategory: 'general', pageSize: 20 })).toEqual({
      jokeCategory: 'general',
      pageSize: 20,
    });
    expect(await getSettings()).toEqual({ jokeCategory: 'general', pageSize: 20 });
    expect(settingsInputSchema.safeParse({ pageSize: 7 }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ jokeCategory: 'knock-knock' }).success).toBe(false);
    await updateSettings({ jokeCategory: 'dad', pageSize: 10 });
  });

  it('saves conversation history', async () => {
    const question = { id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hi' }] };
    const answer = { id: 'm2', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'Hello!' }] };

    await saveConversation('chat-test', [question]);
    await saveConversation('chat-test', [question, answer]);

    const conversation = await Conversation.findOne({ chatId: 'chat-test' }).lean();
    expect(conversation?.messages).toHaveLength(2);
    expect(await Conversation.countDocuments({ chatId: 'chat-test' })).toBe(1);
  });

  it('records tool usage statistics', async () => {
    await trackUsage('demoTool', async () => 'done');
    await expect(
      trackUsage('demoTool', async () => {
        throw new Error('broken');
      }),
    ).rejects.toThrow('broken');

    const stats = await getToolStats();
    expect(stats.find(stat => stat.tool === 'demoTool')).toMatchObject({ calls: 2, errors: 1 });
  });
});
