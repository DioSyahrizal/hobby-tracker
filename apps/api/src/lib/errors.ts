import type { ItemType } from '@hobby-track/shared';

/**
 * Discriminated unions for service-layer return values. Routes pattern-match
 * on `kind` and translate to HTTP responses. Keeps services HTTP-agnostic.
 */

export interface NotFoundResult {
  kind: 'not_found';
}

export interface ActiveLimitExceededResult {
  kind: 'active_limit_exceeded';
  type: ItemType;
  currentActiveCount: number;
  limit: number;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
