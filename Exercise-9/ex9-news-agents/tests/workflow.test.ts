import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runNewsAnalysis } from '@/app/inngest/functions';

const { updateOne, networkRun } = vi.hoisted(() => ({ updateOne: vi.fn(), networkRun: vi.fn() }));

vi.mock('mongodb', () => ({
    MongoClient: class {
        connect() {
            return Promise.resolve(this);
        }
        db() {
            return { collection: () => ({ updateOne }) };
        }
    },
}));

vi.mock('@/lib/network', () => ({
    newsAnalysisNetwork: { run: networkRun },
}));

const event = { data: { input: 'AI technology', runId: 'run_test' } };

describe('runNewsAnalysis', () => {
    beforeEach(() => {
        updateOne.mockReset();
        networkRun.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('fails the run before any model call when the OpenRouter key is missing', async () => {
        vi.stubEnv('OPENROUTER_API_KEY', '');

        await runNewsAnalysis({ event });

        expect(networkRun).not.toHaveBeenCalled();
        expect(updateOne.mock.calls[0][1].$set.error).toContain('OPENROUTER_API_KEY');
    });

    it('fails the run before any model call when the Serper key is missing', async () => {
        vi.stubEnv('SERPER_API_KEY', '');

        await runNewsAnalysis({ event });

        expect(networkRun).not.toHaveBeenCalled();
        expect(updateOne.mock.calls[0][1].$set.error).toContain('SERPER_API_KEY');
    });

    it('marks a run as failed when the network stops before the moderator finishes', async () => {
        networkRun.mockResolvedValue({ state: { data: { runId: 'run_test' } } });

        await runNewsAnalysis({ event });

        const [filter, update] = updateOne.mock.calls[0];
        expect(filter).toEqual({ runId: 'run_test', status: 'running' });
        expect(update.$set.status).toBe('failed');
        expect(update.$set.error).toBe('The agents stopped before finishing the workflow. Please run them again.');
    });

    it('stores a friendly message instead of the raw upstream error', async () => {
        networkRun.mockRejectedValue(new Error('401 Unauthorized: invalid key sk-or-v1-abc123'));

        await expect(runNewsAnalysis({ event })).rejects.toThrow();

        const saved = updateOne.mock.calls[0][1].$set.error;
        expect(saved).toBe('Something went wrong while the agents were running. Please try again.');
        expect(saved).not.toContain('sk-or');
    });
});
