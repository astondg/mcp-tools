/**
 * Enhanced Database Connection
 *
 * Provides properly configured Prisma client with:
 * - Connection pooling
 * - Query logging (development)
 * - Graceful shutdown
 * - Retry logic for transient errors
 * - Performance monitoring
 */

import { PrismaClient } from '@prisma/client';

/**
 * Prisma error codes that are retryable
 */
const RETRYABLE_ERRORS = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timeout
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
]);

/**
 * Create Prisma client singleton
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'info', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// Extend global type to include prisma client
declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * Prisma client instance (singleton)
 */
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Query performance logging (development only)
 */
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as any, (e: any) => {
    const duration = e.duration;
    const query = e.query;

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`[SLOW QUERY] ${duration}ms:`, query.substring(0, 200));
    }

    // Log all queries if verbose logging enabled
    if (process.env.VERBOSE_LOGGING === 'true') {
      console.log(`[QUERY] ${duration}ms:`, query.substring(0, 200));
    }
  });
}

/**
 * Graceful shutdown handler
 */
const shutdown = async () => {
  console.log('Disconnecting Prisma client...');
  await prisma.$disconnect();
  console.log('Prisma client disconnected');
};

// Register shutdown handlers
process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return RETRYABLE_ERRORS.has(error.code);
  }
  return false;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 100, // 100ms
  maxDelay: 5000, // 5s
  backoffMultiplier: 2,
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a database query with retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const user = await withRetry(
 *   () => prisma.user.findUnique({ where: { id: '123' } }),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === retryConfig.maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, retryConfig);
      console.warn(
        `Database query failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), retrying in ${delay}ms...`,
        error
      );

      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Execute a transaction with retry logic
 *
 * @param fn - Transaction function
 * @param config - Retry configuration
 * @returns Transaction result
 */
export async function withRetryTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  return withRetry(
    () => prisma.$transaction(fn as any) as Promise<T>,
    config
  );
}

/**
 * Health check for database connection
 *
 * @returns True if database is accessible
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database connection info
 */
export async function getDatabaseInfo() {
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version() as version
    `;
    return {
      healthy: true,
      version: result[0]?.version,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Batch operations helper
 */
export const BatchOperations = {
  /**
   * Create multiple records in batches to avoid timeout
   */
  async createMany<T>(
    model: any,
    data: T[],
    batchSize: number = 1000
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await model.createMany({ data: batch, skipDuplicates: true });
    }
  },

  /**
   * Update multiple records in batches
   */
  async updateMany<T extends { id: string }>(
    model: any,
    data: T[],
    batchSize: number = 1000
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await Promise.all(
        batch.map(item =>
          model.update({
            where: { id: item.id },
            data: item,
          })
        )
      );
    }
  },

  /**
   * Delete multiple records in batches
   */
  async deleteMany(
    model: any,
    ids: string[],
    batchSize: number = 1000
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await model.deleteMany({
        where: {
          id: { in: batch },
        },
      });
    }
  },
};

/**
 * Query builder helpers
 */
export const QueryHelpers = {
  /**
   * Build pagination object
   */
  pagination: (page: number = 1, pageSize: number = 100) => ({
    skip: (page - 1) * pageSize,
    take: Math.min(pageSize, 1000), // Max 1000 per page
  }),

  /**
   * Build date range filter
   */
  dateRange: (startDate?: Date | string, endDate?: Date | string) => {
    if (!startDate && !endDate) return undefined;

    return {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  },

  /**
   * Build search filter (case-insensitive contains)
   */
  search: (query: string, fields: string[]) => ({
    OR: fields.map(field => ({
      [field]: {
        contains: query,
        mode: 'insensitive' as const,
      },
    })),
  }),

  /**
   * Build sort object
   */
  sort: (field: string, order: 'asc' | 'desc' = 'asc') => ({
    [field]: order,
  }),
};

/**
 * Database metrics (useful for monitoring)
 */
export const DatabaseMetrics = {
  /**
   * Get table row counts
   */
  async getTableCounts() {
    const [
      trips,
      tripItems,
      expenses,
      budgetCategories,
      fitnessGoals,
      vehicles,
    ] = await Promise.all([
      prisma.trip.count(),
      prisma.tripItem.count(),
      prisma.expense.count(),
      prisma.budgetCategory.count(),
      prisma.fitnessGoal.count(),
      prisma.vehicle.count(),
    ]);

    return {
      trips,
      tripItems,
      expenses,
      budgetCategories,
      fitnessGoals,
      vehicles,
      total: trips + tripItems + expenses + budgetCategories + fitnessGoals + vehicles,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Get database size (requires appropriate permissions)
   */
  async getDatabaseSize() {
    try {
      const result = await prisma.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      return result[0]?.size;
    } catch (error) {
      console.error('Failed to get database size:', error);
      return null;
    }
  },
};

// Export Prisma types for convenience
export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
