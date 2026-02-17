/**
 * CacheService — Tenant-scoped cache with TTL
 *
 * Dev: in-memory Map per process
 * Prod (optional): database-backed via cache_entries table
 *
 * Keys are auto-namespaced by tenantId + widget/endpoint name.
 * Multi-tenant safe: keys always include tenantId.
 */

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number; // epoch ms
}

export interface CacheService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;
  stats(): { hits: number; misses: number; size: number };
}

/**
 * Build a cache key scoped to a tenant + widget + optional filters.
 */
export function cacheKey(
  tenantId: string,
  widget: string,
  filters?: Record<string, string | number | boolean | undefined>,
): string {
  const base = `t:${tenantId}:${widget}`;
  if (!filters) return base;

  const sortedPairs = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return sortedPairs ? `${base}:${sortedPairs}` : base;
}

// ─── In-Memory Implementation ──────────────────────────────────────────────

class InMemoryCacheService implements CacheService {
  private store = new Map<string, CacheEntry>();
  private _hits = 0;
  private _misses = 0;

  // Periodic cleanup every 60s to avoid unbounded growth
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 60_000);
    // Allow process to exit without waiting for timer
    if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    let count = 0;
    const keysToDelete: string[] = [];
    this.store.forEach((_, key) => {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      this.store.delete(key);
      count++;
    }
    return count;
  }

  stats() {
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.store.size,
    };
  }

  private evictExpired() {
    const now = Date.now();
    const expired: string[] = [];
    this.store.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expired.push(key);
      }
    });
    for (const key of expired) {
      this.store.delete(key);
    }
  }

  /** For testing: reset all state */
  _reset() {
    this.store.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /** For testing: stop cleanup timer */
  _destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const globalForCache = globalThis as unknown as {
  cacheService: InMemoryCacheService | undefined;
};

export const cache: InMemoryCacheService =
  globalForCache.cacheService ?? new InMemoryCacheService();

if (process.env.NODE_ENV !== "production") {
  globalForCache.cacheService = cache;
}

// ─── Cache TTL Constants ────────────────────────────────────────────────────

export const CacheTTL = {
  /** Dashboard widget: 60 seconds */
  DASHBOARD_WIDGET: 60,
  /** Executive KPI: 120 seconds */
  EXECUTIVE_KPI: 120,
  /** Search facets: 30 seconds */
  SEARCH_FACETS: 30,
  /** Case list: 30 seconds */
  CASE_LIST: 30,
  /** Stats/counts: 60 seconds */
  STATS: 60,
} as const;

// ─── Cache Invalidation Helpers ─────────────────────────────────────────────

/**
 * Invalidate all caches for a given tenant. Call on significant state changes.
 */
export async function invalidateTenantCache(tenantId: string): Promise<number> {
  return cache.invalidatePattern(`t:${tenantId}:`);
}

/**
 * Invalidate caches related to a specific widget for a tenant.
 */
export async function invalidateWidgetCache(
  tenantId: string,
  widget: string,
): Promise<number> {
  return cache.invalidatePattern(`t:${tenantId}:${widget}`);
}
