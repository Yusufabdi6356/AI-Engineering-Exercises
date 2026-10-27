export class CircuitOpenError extends Error {}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private name: string,
    private maxFailures = 3,
    private cooldownMs = 30_000,
  ) {}

  isOpen() {
    return this.failures >= this.maxFailures && Date.now() - this.openedAt < this.cooldownMs;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(`${this.name} is paused after ${this.failures} failed calls`);
    }

    try {
      const result = await task();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.maxFailures) this.openedAt = Date.now();
      throw error;
    }
  }

  reset() {
    this.failures = 0;
    this.openedAt = 0;
  }
}
