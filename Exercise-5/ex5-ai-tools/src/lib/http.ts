const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 2, timeoutMs = 5000) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await wait(200 * 2 ** (attempt - 1));

    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status !== 429 && response.status < 500) return response;
      lastError = new Error(`${new URL(url).host} answered with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
