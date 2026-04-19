/**
 * Minimum-interval gate for outbound calls to a single upstream API.
 *
 * Jikan's free tier permits ~3 req/sec. A naive `await sleep(diff)` based on
 * `lastCallAt` breaks under concurrency: two parallel callers both read the
 * same `lastCallAt`, both sleep the same amount, and fire simultaneously.
 *
 * The fix: chain the waits. Each call awaits the previous chain link plus
 * the interval, so N concurrent acquires resolve at intervalMs, 2*intervalMs,
 * 3*intervalMs, … relative to the first one.
 */
export class IntervalLimiter {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly intervalMs: number) {}

  async acquire(): Promise<void> {
    const previous = this.chain;
    this.chain = previous.then(
      () => new Promise((resolve) => setTimeout(resolve, this.intervalMs)),
    );
    await previous;
  }
}
