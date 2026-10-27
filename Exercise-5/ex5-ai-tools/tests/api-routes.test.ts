import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as query } from '@/app/api/query/route';
import { GET as readSettings, PUT as saveSettings } from '@/app/api/settings/route';
import { GET as readStats } from '@/app/api/stats/route';
import { trackUsage } from '@/lib/usage';
import { closeTestDatabase, postJson, setupTestDatabase } from './helpers';

describe('API routes', () => {
  beforeAll(setupTestDatabase);
  afterAll(closeTestDatabase);

  it('POST /api/query returns the next page of a database result', async () => {
    const response = await query(
      postJson('http://localhost/api/query', {
        collection: 'movies',
        filters: [{ field: 'rating', operator: 'greaterThan', value: 8.5 }],
        sortBy: 'rating',
        page: 2,
        pageSize: 10,
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ page: 2, totalPages: 2, total: 14 });
    expect(result.rows).toHaveLength(4);
  });

  it('POST /api/query explains invalid queries', async () => {
    const badField = await query(
      postJson('http://localhost/api/query', {
        collection: 'users',
        filters: [{ field: 'salary', operator: 'greaterThan', value: 10 }],
      }),
    );
    const badShape = await query(postJson('http://localhost/api/query', { collection: 'planets' }));

    expect(badField.status).toBe(400);
    expect((await badField.json()).error).toContain('"salary" is not a field of users');
    expect(badShape.status).toBe(400);
  });

  it('GET and PUT /api/settings read and save preferences', async () => {
    expect(await (await readSettings()).json()).toEqual({ jokeCategory: 'dad', pageSize: 10 });

    const saved = await saveSettings(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ jokeCategory: 'programming' }),
      }),
    );
    expect(await saved.json()).toEqual({ jokeCategory: 'programming', pageSize: 10 });

    const invalid = await saveSettings(
      new Request('http://localhost/api/settings', { method: 'PUT', body: JSON.stringify({ pageSize: 1000 }) }),
    );
    expect(invalid.status).toBe(400);
  });

  it('GET /api/stats summarises tool usage', async () => {
    await trackUsage('queryDatabase', async () => 'ok');
    await trackUsage('queryDatabase', async () => 'ok');

    const stats = await (await readStats()).json();

    expect(stats).toEqual([expect.objectContaining({ tool: 'queryDatabase', calls: 2, errors: 0 })]);
  });
});
