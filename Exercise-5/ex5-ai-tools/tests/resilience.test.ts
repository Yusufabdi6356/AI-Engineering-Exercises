import { afterEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '@/lib/circuit-breaker';
import { fetchWithRetry } from '@/lib/http';
import { isRateLimited } from '@/lib/rate-limit';
import { failingFetch, jsonResponse, mockFetch } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchWithRetry', () => {
  it('retries network errors and server errors, then succeeds', async () => {
    let call = 0;
    const fetch = mockFetch(() => {
      call += 1;
      if (call === 1) throw new TypeError('fetch failed');
      if (call === 2) return jsonResponse({ error: 'busy' }, 503);
      return jsonResponse({ ok: true });
    });

    const response = await fetchWithRetry('https://example.com/data');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('does not retry client errors', async () => {
    const fetch = mockFetch(() => jsonResponse({ error: 'missing' }, 404));

    const response = await fetchWithRetry('https://example.com/data');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });

  it('gives up after the last retry', async () => {
    const fetch = failingFetch();

    await expect(fetchWithRetry('https://example.com/data', {}, 1)).rejects.toThrow('fetch failed');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('CircuitBreaker', () => {
  it('opens after repeated failures and closes again after the cooldown', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const breaker = new CircuitBreaker('test service', 2, 1000);
    const failing = () => Promise.reject(new Error('down'));

    await expect(breaker.run(failing)).rejects.toThrow('down');
    await expect(breaker.run(failing)).rejects.toThrow('down');
    expect(breaker.isOpen()).toBe(true);

    const task = vi.fn(async () => 'ok');
    await expect(breaker.run(task)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(task).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 1001);
    await expect(breaker.run(task)).resolves.toBe('ok');
    expect(breaker.isOpen()).toBe(false);
  });
});

describe('isRateLimited', () => {
  it('allows 20 chat requests a minute', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);

    const results = Array.from({ length: 21 }, () => isRateLimited());
    expect(results.slice(0, 20).every(limited => !limited)).toBe(true);
    expect(results[20]).toBe(true);

    vi.setSystemTime(Date.now() + 60_000);
    expect(isRateLimited()).toBe(false);
  });
});
