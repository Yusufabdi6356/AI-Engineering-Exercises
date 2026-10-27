import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { updateSettings } from '@/lib/settings';
import { queryInputSchema, runQuery } from '@/tools/query-database';
import { closeTestDatabase, setupTestDatabase } from './helpers';

const run = (input: unknown) => runQuery(queryInputSchema.parse(input));

describe('queryDatabase tool', () => {
  beforeAll(setupTestDatabase);
  afterAll(closeTestDatabase);

  it('shows all sci-fi movies', async () => {
    const result = await run({
      collection: 'movies',
      filters: [{ field: 'genre', operator: 'equals', value: 'sci-fi' }],
    });

    expect(result.total).toBe(8);
    expect(result.rows).toHaveLength(8);
    expect(result.rows.every(row => row.genre === 'Sci-Fi')).toBe(true);
    expect(result.rows.map(row => row.title)).toContain('Inception');
    expect(result.mongoQuery).toContain('"genre":{"$eq":"Sci-Fi"}');
  });

  it('finds users over 25', async () => {
    const result = await run({
      collection: 'users',
      filters: [{ field: 'age', operator: 'greaterThan', value: 25 }],
    });

    expect(result.total).toBe(10);
    expect(result.rows.every(row => Number(row.age) > 25)).toBe(true);
    expect(result.rows.map(row => row.name)).not.toContain('Elena Rossi');
  });

  it('gets movies with rating above 8.5, paginated and sorted', async () => {
    const input = {
      collection: 'movies',
      filters: [{ field: 'rating', operator: 'greaterThan', value: 8.5 }],
      sortBy: 'rating',
      sortOrder: 'desc',
    };
    const firstPage = await run(input);

    expect(firstPage.total).toBe(14);
    expect(firstPage.pageSize).toBe(10);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.rows).toHaveLength(10);
    expect(firstPage.rows[0].title).toBe('The Shawshank Redemption');
    const ratings = firstPage.rows.map(row => Number(row.rating));
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));

    const secondPage = await run({ ...input, page: 2 });
    expect(secondPage.rows).toHaveLength(4);
    expect(secondPage.rows.every(row => Number(row.rating) > 8.5)).toBe(true);
  });

  it('counts total movies by genre', async () => {
    const result = await run({ collection: 'movies', operation: 'countBy', groupBy: 'genre' });

    expect(result.total).toBe(36);
    expect(result.rows[0]).toEqual({ genre: 'Sci-Fi', count: 8 });
    expect(result.rows).toContainEqual({ genre: 'Drama', count: 4 });
    expect(result.rows).toHaveLength(11);
  });

  it('counts matching documents', async () => {
    const result = await run({ collection: 'reviews', operation: 'count' });
    expect(result.rows).toEqual([{ count: 30 }]);
  });

  it('supports contains and in filters', async () => {
    const nolan = await run({
      collection: 'movies',
      filters: [{ field: 'director', operator: 'contains', value: 'nolan' }],
    });
    expect(nolan.total).toBe(3);

    const horrorOrRomance = await run({
      collection: 'movies',
      filters: [{ field: 'genre', operator: 'in', value: ['Horror', 'romance'] }],
    });
    expect(horrorOrRomance.total).toBe(4);
  });

  it('shows reviews with the movie title and user name', async () => {
    const result = await run({
      collection: 'reviews',
      filters: [{ field: 'rating', operator: 'equals', value: 10 }],
    });

    expect(result.total).toBe(7);
    expect(result.rows[0].movie).toBeTypeOf('string');
    expect(result.rows[0].user).toBeTypeOf('string');
    expect(result.rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('follows ids between collections', async () => {
    const movie = await run({
      collection: 'movies',
      filters: [{ field: 'title', operator: 'equals', value: 'The Godfather' }],
    });
    const reviews = await run({
      collection: 'reviews',
      filters: [{ field: 'movie_id', operator: 'equals', value: String(movie.rows[0].id) }],
    });

    expect(reviews.total).toBe(2);
    expect(reviews.rows.every(row => row.movie === 'The Godfather')).toBe(true);
  });

  it('rejects invalid queries with friendly messages', async () => {
    await expect(
      run({ collection: 'movies', filters: [{ field: 'budget', operator: 'equals', value: 1 }] }),
    ).rejects.toThrow('"budget" is not a field of movies');
    await expect(
      run({ collection: 'movies', filters: [{ field: 'rating', operator: 'contains', value: '8' }] }),
    ).rejects.toThrow('"contains" only works on text fields');
    await expect(
      run({ collection: 'movies', filters: [{ field: 'genre', operator: 'greaterThan', value: 'Drama' }] }),
    ).rejects.toThrow('only works on number and date fields');
    await expect(
      run({ collection: 'movies', filters: [{ field: 'genre', operator: 'equals', value: 'Western' }] }),
    ).rejects.toThrow('"Western" is not a known genre');
    await expect(
      run({ collection: 'users', filters: [{ field: 'age', operator: 'greaterThan', value: 'old' }] }),
    ).rejects.toThrow('age needs a number');
    await expect(
      run({ collection: 'reviews', filters: [{ field: 'movie_id', operator: 'equals', value: '123' }] }),
    ).rejects.toThrow('"123" is not a valid movie_id');
    await expect(run({ collection: 'movies', operation: 'countBy' })).rejects.toThrow('countBy needs a groupBy');
    expect(queryInputSchema.safeParse({ collection: 'orders' }).success).toBe(false);
    expect(queryInputSchema.safeParse({ collection: 'movies', pageSize: 500 }).success).toBe(false);
  });

  it('uses the saved page size when the query does not set one', async () => {
    await updateSettings({ pageSize: 5 });
    const result = await run({
      collection: 'movies',
      filters: [{ field: 'rating', operator: 'greaterThan', value: 8.5 }],
    });
    await updateSettings({ pageSize: 10 });

    expect(result.pageSize).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.rows).toHaveLength(5);
  });
});
