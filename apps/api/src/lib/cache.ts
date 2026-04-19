/**
 * Simple in-memory LRU cache with per-entry TTL.
 *
 * Backed by a plain Map (which preserves insertion order in JS), so on `get`
 * we delete + re-set the key to mark it most-recently-used. When `size`
 * exceeds `maxEntries`, the oldest key is evicted.
 *
 * Used by external-search clients to dedupe identical queries within the TTL
 * window. Not shared across processes — when we scale beyond a single PM2
 * instance we'll swap this for Redis or similar.
 */
export interface CacheOptions {
  /** Max entries before LRU eviction kicks in. Default 200. */
  maxEntries?: number;
  /** Time-to-live in milliseconds. Default 1 hour. */
  ttlMs?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<K, V> {
  private readonly store = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(opts: CacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 200;
    this.ttlMs = opts.ttlMs ?? 60 * 60 * 1000;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    // Mark as most-recently-used by reinserting.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Refresh position if already present.
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });

    // Evict oldest while over capacity.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
