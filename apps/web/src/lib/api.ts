import { queryOptions } from '@tanstack/react-query';

/**
 * Central API client for the hobby-track backend.
 *
 * All requests go through the Vite dev proxy (/api → localhost:3000)
 * or, in production, hit the Fastify process directly (same origin).
 *
 * Errors are surfaced as plain `Error` instances so TanStack Query's
 * error handling just works. The `code` and `message` come from the
 * API's standard `{ error: { code, message } }` shape.
 */

interface ApiError {
  error: { code: string; message: string };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Only set Content-Type when there is a body. Fastify rejects
  // Content-Type: application/json with an empty body (FST_ERR_CTP_EMPTY_JSON_BODY).
  const res = await fetch(path, {
    ...init,
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : {},
  });

  const body = (await res.json()) as T | ApiError;

  if (!res.ok) {
    const err = body as ApiError;
    throw new HttpError(
      res.status,
      err.error.code,
      err.error.message,
    );
  }

  return body as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthMe {
  authenticated: boolean;
}

export const authQueryOptions = queryOptions({
  queryKey: ['auth', 'me'] as const,
  queryFn: (): Promise<AuthMe> => apiFetch('/api/auth/me'),
  staleTime: Infinity,
  retry: false,
});

export async function login(password: string): Promise<void> {
  await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}
