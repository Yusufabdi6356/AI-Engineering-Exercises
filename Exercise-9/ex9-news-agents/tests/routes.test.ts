import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as runAgents } from '@/app/api/run-agents/route';
import { GET as getResult } from '@/app/api/results/[runId]/route';
import { GET as getPoster } from '@/app/api/posters/[id]/route';

const { insertOne, findOne, updateOne, send } = vi.hoisted(() => ({
    insertOne: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
    send: vi.fn(),
}));

vi.mock('mongodb', async (importOriginal) => ({
    ...(await importOriginal<typeof import('mongodb')>()),
    MongoClient: class {
        connect() {
            return Promise.resolve(this);
        }
        db() {
            return { collection: () => ({ insertOne, findOne, updateOne }) };
        }
    },
}));

vi.mock('@/app/inngest/client', () => ({ inngest: { send } }));

function post(body: string) {
    return new NextRequest('http://localhost/api/run-agents', { method: 'POST', body });
}

const runId = 'run_0b8f2c1e-4a8d-4c47-9e0a-6f1d2b3c4d5e';

describe('POST /api/run-agents', () => {
    beforeEach(() => {
        insertOne.mockReset();
        send.mockReset();
    });

    it('rejects an empty query without starting a run', async () => {
        const res = await runAgents(post(JSON.stringify({ input: '   ' })));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'Please enter a search query' });
        expect(send).not.toHaveBeenCalled();
    });

    it('rejects a query that is too long without starting a run', async () => {
        const res = await runAgents(post(JSON.stringify({ input: 'a'.repeat(201) })));

        expect(res.status).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });

    it('rejects a body that is not JSON or not a string query', async () => {
        expect((await runAgents(post('not json'))).status).toBe(400);
        expect((await runAgents(post(JSON.stringify({ input: { $ne: '' } })))).status).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });

    it('starts a run with the trimmed query', async () => {
        const res = await runAgents(post(JSON.stringify({ input: '  AI technology  ' })));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.runId).toMatch(/^run_[0-9a-f-]{36}$/);
        expect(send.mock.calls[0][0].data).toEqual({ input: 'AI technology', runId: data.runId });
    });
});

describe('GET /api/results/[runId]', () => {
    beforeEach(() => {
        findOne.mockReset();
        updateOne.mockReset();
    });

    it('returns 404 for a run id that is not in the expected format', async () => {
        const res = await getResult(new NextRequest('http://localhost'), { params: Promise.resolve({ runId: '{"$ne":null}' }) });

        expect(res.status).toBe(404);
        expect(findOne).not.toHaveBeenCalled();
    });

    it('marks a run that stopped updating as failed', async () => {
        const old = new Date(Date.now() - 11 * 60 * 1000);
        findOne.mockResolvedValue({ runId, status: 'running', state: {}, createdAt: old, updatedAt: old });

        const data = await (await getResult(new NextRequest('http://localhost'), { params: Promise.resolve({ runId }) })).json();

        expect(data.status).toBe('failed');
        expect(data.error).toBe('The agents stopped responding. Please run them again.');
        expect(updateOne.mock.calls[0][0]).toEqual({ runId, status: 'running' });
    });

    it('leaves a run that is still updating alone', async () => {
        findOne.mockResolvedValue({ runId, status: 'running', state: {}, createdAt: new Date(), updatedAt: new Date() });

        const data = await (await getResult(new NextRequest('http://localhost'), { params: Promise.resolve({ runId }) })).json();

        expect(data.status).toBe('running');
        expect(updateOne).not.toHaveBeenCalled();
    });
});

describe('GET /api/posters/[id]', () => {
    it('returns 404 for a bad or unknown poster id', async () => {
        findOne.mockResolvedValue(null);

        const bad = await getPoster(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'not-an-id' }) });
        const unknown = await getPoster(new NextRequest('http://localhost'), { params: Promise.resolve({ id: '6ae0778f863c4e5d6c643078' }) });

        expect(bad.status).toBe(404);
        expect(unknown.status).toBe(404);
    });
});
