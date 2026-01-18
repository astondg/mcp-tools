/**
 * Caching Utilities
 *
 * Provides Redis-based caching layer for expensive queries and computations
 * Reduces database load and improves response times
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache configuration interface
 */
interface CacheOptions {
  /**
   * Time to live in seconds
   * @default 300 (5 minutes)
   */
  ttl?: number;

  /**
   * Namespace/prefix for cache keys
   */
  namespace?: string;

  /**
   * Whether to use stale-while-revalidate pattern
   * @default false
   */
  staleWhileRevalidate?: boolean;

  /**
   * Stale time in seconds (for SWR pattern)
   * @default 60
   */
  staleTime?: number;
}

/**
 * Default cache options
 */
const DEFAULT_OPTIONS: Required<CacheOptions> = {
  ttl: 300, // 5 minutes
  namespace: 'mcp',
  staleWhileRevalidate: false,
  staleTime: 60, // 1 minute
};

/**
 * Build cache key with namespace
 */
function buildCacheKey(key: string, namespace?: string): string {
  const ns = namespace || DEFAULT_OPTIONS.namespace;
  return `${ns}:${key}`;
}

/**
 * Get cached value or fetch and cache if not found
 *
 * @param key - Cache key (will be prefixed with namespace)
 * @param fetcher - Function to fetch data if not cached
 * @param options - Cache configuration options
 * @returns Cached or freshly fetched data
 *
 * @example
 * ```typescript
 * const tripStatus = await getCached(
 *   `trip:${tripId}:status`,
 *   async () => await calculateTripStatus(tripId),
 *   { ttl: 300, namespace: 'trip' }
 * );
 * ```
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = buildCacheKey(key, opts.namespace);

  try {
    // Try to get from cache
    const cached = await redis.get<T>(cacheKey);

    if (cached !== null && cached !== undefined) {
      // Cache hit
      return cached;
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Cache the result
    await redis.setex(cacheKey, opts.ttl, data);

    return data;
  } catch (error) {
    // If Redis fails, still fetch the data
    console.error('Cache error (falling back to direct fetch):', error);
    return await fetcher();
  }
}

/**
 * Get cached value with stale-while-revalidate pattern
 * Returns stale data immediately while revalidating in background
 *
 * @param key - Cache key
 * @param fetcher - Function to fetch fresh data
 * @param options - Cache options with staleTime
 * @returns Cached or fresh data
 */
export async function getCachedSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = buildCacheKey(key, opts.namespace);
  const timestampKey = `${cacheKey}:timestamp`;

  try {
    const [cached, timestamp] = await Promise.all([
      redis.get<T>(cacheKey),
      redis.get<number>(timestampKey),
    ]);

    const now = Date.now();
    const isStale = timestamp ? (now - timestamp) / 1000 > opts.staleTime : true;

    if (cached !== null && cached !== undefined) {
      // Return cached data
      if (isStale) {
        // Revalidate in background (don't await)
        revalidateInBackground(cacheKey, timestampKey, fetcher, opts.ttl);
      }
      return cached;
    }

    // No cached data - fetch and cache
    const data = await fetcher();
    await Promise.all([
      redis.setex(cacheKey, opts.ttl, data),
      redis.setex(timestampKey, opts.ttl, now),
    ]);

    return data;
  } catch (error) {
    console.error('Cache SWR error:', error);
    return await fetcher();
  }
}

/**
 * Revalidate cache in background
 */
async function revalidateInBackground<T>(
  cacheKey: string,
  timestampKey: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<void> {
  try {
    const data = await fetcher();
    await Promise.all([
      redis.setex(cacheKey, ttl, data),
      redis.setex(timestampKey, ttl, Date.now()),
    ]);
  } catch (error) {
    console.error('Background revalidation error:', error);
  }
}

/**
 * Set a value in cache
 *
 * @param key - Cache key
 * @param value - Value to cache
 * @param options - Cache options
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = buildCacheKey(key, opts.namespace);

  try {
    await redis.setex(cacheKey, opts.ttl, value);
  } catch (error) {
    console.error('Error setting cache:', error);
    // Don't throw - caching failures should be silent
  }
}

/**
 * Get a value from cache without fetching
 *
 * @param key - Cache key
 * @param options - Cache options (for namespace)
 * @returns Cached value or null
 */
export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = buildCacheKey(key, opts.namespace);

  try {
    const value = await redis.get<T>(cacheKey);
    return value ?? null;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

/**
 * Invalidate a single cache key
 *
 * @param key - Cache key to invalidate
 * @param namespace - Cache namespace
 */
export async function invalidateCache(
  key: string,
  namespace?: string
): Promise<void> {
  const cacheKey = buildCacheKey(key, namespace);

  try {
    await redis.del(cacheKey);
    // Also delete timestamp key if exists (for SWR)
    await redis.del(`${cacheKey}:timestamp`);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

/**
 * Invalidate multiple cache keys by pattern
 * Note: This scans keys, so use sparingly in production
 *
 * @param pattern - Pattern to match (e.g., "trip:123:*")
 * @param namespace - Cache namespace
 */
export async function invalidateCachePattern(
  pattern: string,
  namespace?: string
): Promise<void> {
  const fullPattern = buildCacheKey(pattern, namespace);

  try {
    // Get all keys matching pattern
    const keys = await redis.keys(fullPattern);

    if (keys.length > 0) {
      // Delete all matching keys
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error invalidating cache pattern:', error);
  }
}

/**
 * Invalidate all caches in a namespace
 *
 * @param namespace - Namespace to clear
 */
export async function invalidateNamespace(namespace: string): Promise<void> {
  await invalidateCachePattern('*', namespace);
}

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  /**
   * Trip-related cache keys
   */
  trip: {
    status: (tripId: string) => `trip:${tripId}:status`,
    budget: (tripId: string) => `trip:${tripId}:budget`,
    timeline: (tripId: string) => `trip:${tripId}:timeline`,
    packing: (tripId: string) => `trip:${tripId}:packing`,
    summary: (tripId: string) => `trip:${tripId}:summary`,
    all: (tripId: string) => `trip:${tripId}:*`,
  },

  /**
   * Budget-related cache keys
   */
  budget: {
    summary: (period: string, startDate?: string) =>
      `budget:summary:${period}:${startDate || 'current'}`,
    balance: (period: string, startDate?: string) =>
      `budget:balance:${period}:${startDate || 'current'}`,
    annual: (year: number) => `budget:annual:${year}`,
    vsActuals: (year: number) => `budget:vsactuals:${year}`,
  },

  /**
   * Fitness-related cache keys
   */
  fitness: {
    progressSummary: () => 'fitness:progress:summary',
    weeklySummary: (weekStart: string) => `fitness:weekly:${weekStart}`,
    goalProgress: (goalId: string) => `fitness:goal:${goalId}:progress`,
  },

  /**
   * Vehicle-related cache keys
   */
  vehicle: {
    upcoming: (vehicleId: string) => `vehicle:${vehicleId}:upcoming`,
    history: (vehicleId: string) => `vehicle:${vehicleId}:history`,
  },

  /**
   * Shopping-related cache keys
   */
  shopping: {
    profile: () => 'shopping:profile',
    deals: (query?: string) => `shopping:deals:${query || 'all'}`,
    matching: () => 'shopping:deals:matching',
  },
};

/**
 * Pre-configured cache functions for common use cases
 */
export const CachePresets = {
  /**
   * Short cache (1 minute) - for frequently changing data
   */
  short: (ttl: number = 60) => ({ ttl, namespace: 'mcp' }),

  /**
   * Medium cache (5 minutes) - default for most queries
   */
  medium: (ttl: number = 300) => ({ ttl, namespace: 'mcp' }),

  /**
   * Long cache (30 minutes) - for stable data
   */
  long: (ttl: number = 1800) => ({ ttl, namespace: 'mcp' }),

  /**
   * Extended cache (1 hour) - for rarely changing data
   */
  extended: (ttl: number = 3600) => ({ ttl, namespace: 'mcp' }),

  /**
   * Stale-while-revalidate (5 min cache, 1 min stale)
   */
  swr: (ttl: number = 300, staleTime: number = 60) => ({
    ttl,
    staleWhileRevalidate: true,
    staleTime,
    namespace: 'mcp',
  }),
};

/**
 * Batch cache operations
 */
export const CacheBatch = {
  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], namespace?: string): Promise<(T | null)[]> {
    const cacheKeys = keys.map(k => buildCacheKey(k, namespace));
    try {
      const values = await redis.mget<T[]>(...cacheKeys);
      return values.map(v => v ?? null);
    } catch (error) {
      console.error('Error in batch get:', error);
      return keys.map(() => null);
    }
  },

  /**
   * Set multiple keys at once
   */
  async mset(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    namespace?: string
  ): Promise<void> {
    try {
      await Promise.all(
        entries.map(({ key, value, ttl }) =>
          setCache(key, value, { ttl, namespace })
        )
      );
    } catch (error) {
      console.error('Error in batch set:', error);
    }
  },

  /**
   * Delete multiple keys at once
   */
  async mdel(keys: string[], namespace?: string): Promise<void> {
    const cacheKeys = keys.map(k => buildCacheKey(k, namespace));
    try {
      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }
    } catch (error) {
      console.error('Error in batch delete:', error);
    }
  },
};

/**
 * Export Redis client for direct use if needed
 */
export { redis };
