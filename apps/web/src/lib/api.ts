import { queryOptions } from '@tanstack/react-query';
import type {
  Item,
  ItemCreate,
  ItemListQuery,
  ItemListResponse,
  ItemUpdate,
  SearchResponse,
  Settings,
  SettingsUpdate,
} from '@hobby-track/shared';

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
  error: { code: string; message: string; details?: unknown };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
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

  // 204 No Content — body is empty, nothing to parse (e.g. DELETE success).
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const body = (await res.json()) as T | ApiError;

  if (!res.ok) {
    const err = body as ApiError;
    throw new HttpError(res.status, err.error.code, err.error.message, err.error.details);
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

// ── Items ─────────────────────────────────────────────────────────────────────

export const itemsQueryOptions = (params: ItemListQuery) =>
  queryOptions({
    queryKey: ['items', params] as const,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.type) qs.set('type', params.type);
      if (params.status) qs.set('status', params.status);
      if (params.search) qs.set('search', params.search);
      if (params.sort) qs.set('sort', params.sort);
      if (params.limit != null) qs.set('limit', String(params.limit));
      if (params.offset != null) qs.set('offset', String(params.offset));
      return apiFetch<ItemListResponse>(`/api/items?${qs.toString()}`);
    },
    staleTime: 30_000,
  });

export const itemQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['items', id] as const,
    queryFn: () => apiFetch<Item>(`/api/items/${id}`),
    staleTime: 30_000,
  });

export async function createItem(data: ItemCreate, force?: boolean): Promise<Item> {
  const url = force ? '/api/items?force=true' : '/api/items';
  return apiFetch<Item>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateItem(
  id: string,
  data: ItemUpdate,
  force?: boolean,
): Promise<Item> {
  const url = force ? `/api/items/${id}?force=true` : `/api/items/${id}`;
  return apiFetch<Item>(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await apiFetch(`/api/items/${id}`, { method: 'DELETE' });
}

/** Upload a cover image for a gunpla item. Uses raw fetch — no Content-Type override. */
export async function uploadCover(id: string, file: File): Promise<Item> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/items/${id}/cover`, {
    method: 'POST',
    body: formData,
    // No Content-Type header: browser sets multipart/form-data with boundary automatically
  });

  const body = (await res.json()) as Item | ApiError;
  if (!res.ok) {
    const err = body as ApiError;
    throw new HttpError(res.status, err.error.code, err.error.message);
  }
  return body as Item;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export const settingsQueryOptions = queryOptions({
  queryKey: ['settings'] as const,
  queryFn: () => apiFetch<Settings>('/api/settings'),
  staleTime: Infinity,
});

export async function updateSettings(data: SettingsUpdate): Promise<Settings> {
  return apiFetch<Settings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

const SEARCH_ENDPOINT = {
  game: 'games',
  anime: 'anime',
  book: 'books',
} as const;

export const searchQueryOptions = (
  type: 'game' | 'anime' | 'book',
  q: string,
) =>
  queryOptions({
    queryKey: ['search', type, q] as const,
    queryFn: () =>
      apiFetch<SearchResponse>(
        `/api/search/${SEARCH_ENDPOINT[type]}?q=${encodeURIComponent(q)}&limit=10`,
      ),
    enabled: q.trim().length >= 2,
    staleTime: 60 * 60 * 1000, // 1h — backend caches too
    retry: false,
  });
