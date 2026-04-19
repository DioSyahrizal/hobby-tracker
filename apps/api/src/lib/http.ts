import { AppError } from './errors.js';

/**
 * Thin wrapper around the global `fetch` for upstream API calls.
 *
 * - 10s default timeout via AbortController
 * - Normalizes non-2xx responses into `AppError('UPSTREAM_ERROR', …, 502)` so
 *   the global error handler returns a clean 502 to clients
 * - Returns parsed JSON typed as `unknown` (callers validate with Zod)
 */
export interface FetchJsonOptions {
  timeoutMs?: number;
  /** Label used in error messages (e.g. "RAWG", "Jikan"). */
  upstream: string;
  headers?: Record<string, string>;
}

export async function fetchJson(
  url: string,
  opts: FetchJsonOptions,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => {
      controller.abort();
    },
    opts.timeoutMs ?? 10_000,
  );

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', ...opts.headers },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    throw new AppError(
      'UPSTREAM_ERROR',
      `${opts.upstream} request failed: ${reason}`,
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new AppError(
      'UPSTREAM_ERROR',
      `${opts.upstream} returned ${String(res.status)}`,
      502,
    );
  }

  try {
    return await res.json();
  } catch {
    throw new AppError(
      'UPSTREAM_ERROR',
      `${opts.upstream} returned non-JSON response`,
      502,
    );
  }
}
