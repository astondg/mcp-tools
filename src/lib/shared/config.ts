/**
 * Configuration Management
 *
 * Centralized configuration with environment variable validation
 * Provides type-safe access to all application settings
 */

import { z } from 'zod';

/**
 * Environment schema
 */
const EnvironmentSchema = z.enum(['development', 'production', 'test']);

/**
 * Database configuration schema
 */
const DatabaseConfigSchema = z.object({
  url: z.string().url('Database URL must be a valid URL'),
  unpooledUrl: z.string().url('Unpooled database URL must be a valid URL').optional(),
  logQueries: z.boolean().default(false),
  connectionTimeout: z.number().int().positive().default(30000), // 30 seconds
});

/**
 * Redis configuration schema
 */
const RedisConfigSchema = z.object({
  url: z.string().url('Redis URL must be a valid URL'),
  token: z.string().min(1, 'Redis token is required'),
  enabled: z.boolean().default(true),
  defaultTtl: z.number().int().positive().default(300), // 5 minutes
});

/**
 * Application configuration schema
 */
const AppConfigSchema = z.object({
  name: z.string().default('MCP Tools'),
  version: z.string().default('1.0.0'),
  port: z.number().int().positive().default(3000),
  defaultCurrency: z.string().length(3).toUpperCase().default('AUD'),
  maxQueryResults: z.number().int().positive().default(100),
  maxUploadSize: z.number().int().positive().default(10485760), // 10MB
  enableQueryLogging: z.boolean().default(false),
  enableCaching: z.boolean().default(true),
  enableMetrics: z.boolean().default(false),
});

/**
 * Logging configuration schema
 */
const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  prettyPrint: z.boolean().default(false),
  redactSensitive: z.boolean().default(true),
});

/**
 * Cache configuration schema
 */
const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultTtl: z.number().int().positive().default(300), // 5 minutes
  shortTtl: z.number().int().positive().default(60), // 1 minute
  mediumTtl: z.number().int().positive().default(300), // 5 minutes
  longTtl: z.number().int().positive().default(1800), // 30 minutes
  extendedTtl: z.number().int().positive().default(3600), // 1 hour
});

/**
 * Feature flags schema
 */
const FeaturesConfigSchema = z.object({
  tripPlanning: z.boolean().default(true),
  budgetTracking: z.boolean().default(true),
  fitnessTracking: z.boolean().default(true),
  vehicleMaintenance: z.boolean().default(true),
  shopping: z.boolean().default(true),
  budgetScenarios: z.boolean().default(true),
  collaboration: z.boolean().default(false), // Not yet implemented
  aiInsights: z.boolean().default(false), // Future feature
  mobileApp: z.boolean().default(false), // Future feature
});

/**
 * Rate limiting configuration schema
 */
const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  windowMs: z.number().int().positive().default(60000), // 1 minute
  maxRequests: z.number().int().positive().default(100),
});

/**
 * Security configuration schema
 */
const SecurityConfigSchema = z.object({
  enableCors: z.boolean().default(true),
  allowedOrigins: z.array(z.string()).default(['*']),
  enableHelmet: z.boolean().default(true),
  maxRequestSize: z.string().default('10mb'),
});

/**
 * Performance configuration schema
 */
const PerformanceConfigSchema = z.object({
  slowQueryThreshold: z.number().int().positive().default(1000), // 1 second
  enableQueryOptimization: z.boolean().default(true),
  batchSize: z.number().int().positive().default(1000),
});

/**
 * External services configuration
 */
const ExternalServicesConfigSchema = z.object({
  freelancer: z.object({
    enabled: z.boolean().default(true),
    apiUrl: z.string().url().default('https://www.freelancer.com/api'),
  }),
  remoteJobs: z.object({
    enabled: z.boolean().default(true),
    providers: z.array(z.enum(['weworkremotely', 'remotive', 'himalayas'])).default([
      'weworkremotely',
      'remotive',
      'himalayas',
    ]),
  }),
  ozbargain: z.object({
    enabled: z.boolean().default(true),
    apiUrl: z.string().url().default('https://www.ozbargain.com.au'),
    cacheDeals: z.boolean().default(true),
  }),
});

/**
 * Main configuration schema
 */
const ConfigSchema = z.object({
  env: EnvironmentSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  app: AppConfigSchema,
  logging: LoggingConfigSchema,
  cache: CacheConfigSchema,
  features: FeaturesConfigSchema,
  rateLimit: RateLimitConfigSchema,
  security: SecurityConfigSchema,
  performance: PerformanceConfigSchema,
  externalServices: ExternalServicesConfigSchema,
});

/**
 * Configuration type
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse number from environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array from environment variable (comma-separated)
 */
function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
  const rawConfig = {
    env: (process.env.NODE_ENV as any) || 'development',

    database: {
      url: process.env.DATABASE_URL || '',
      unpooledUrl: process.env.DATABASE_URL_UNPOOLED,
      logQueries: parseBoolean(process.env.DATABASE_LOG_QUERIES, false),
      connectionTimeout: parseNumber(process.env.DATABASE_TIMEOUT, 30000),
    },

    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
      enabled: parseBoolean(process.env.REDIS_ENABLED, true),
      defaultTtl: parseNumber(process.env.REDIS_DEFAULT_TTL, 300),
    },

    app: {
      name: process.env.APP_NAME || 'MCP Tools',
      version: process.env.APP_VERSION || '1.0.0',
      port: parseNumber(process.env.PORT, 3000),
      defaultCurrency: (process.env.DEFAULT_CURRENCY || 'AUD').toUpperCase(),
      maxQueryResults: parseNumber(process.env.MAX_QUERY_RESULTS, 100),
      maxUploadSize: parseNumber(process.env.MAX_UPLOAD_SIZE, 10485760),
      enableQueryLogging: parseBoolean(process.env.ENABLE_QUERY_LOGGING, false),
      enableCaching: parseBoolean(process.env.ENABLE_CACHING, true),
      enableMetrics: parseBoolean(process.env.ENABLE_METRICS, false),
    },

    logging: {
      level: (process.env.LOG_LEVEL || 'info') as any,
      prettyPrint: parseBoolean(process.env.LOG_PRETTY, process.env.NODE_ENV === 'development'),
      redactSensitive: parseBoolean(process.env.LOG_REDACT_SENSITIVE, true),
    },

    cache: {
      enabled: parseBoolean(process.env.CACHE_ENABLED, true),
      defaultTtl: parseNumber(process.env.CACHE_DEFAULT_TTL, 300),
      shortTtl: parseNumber(process.env.CACHE_SHORT_TTL, 60),
      mediumTtl: parseNumber(process.env.CACHE_MEDIUM_TTL, 300),
      longTtl: parseNumber(process.env.CACHE_LONG_TTL, 1800),
      extendedTtl: parseNumber(process.env.CACHE_EXTENDED_TTL, 3600),
    },

    features: {
      tripPlanning: parseBoolean(process.env.FEATURE_TRIP_PLANNING, true),
      budgetTracking: parseBoolean(process.env.FEATURE_BUDGET_TRACKING, true),
      fitnessTracking: parseBoolean(process.env.FEATURE_FITNESS_TRACKING, true),
      vehicleMaintenance: parseBoolean(process.env.FEATURE_VEHICLE_MAINTENANCE, true),
      shopping: parseBoolean(process.env.FEATURE_SHOPPING, true),
      budgetScenarios: parseBoolean(process.env.FEATURE_BUDGET_SCENARIOS, true),
      collaboration: parseBoolean(process.env.FEATURE_COLLABORATION, false),
      aiInsights: parseBoolean(process.env.FEATURE_AI_INSIGHTS, false),
      mobileApp: parseBoolean(process.env.FEATURE_MOBILE_APP, false),
    },

    rateLimit: {
      enabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, false),
      windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
      maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    },

    security: {
      enableCors: parseBoolean(process.env.ENABLE_CORS, true),
      allowedOrigins: parseArray(process.env.ALLOWED_ORIGINS, ['*']),
      enableHelmet: parseBoolean(process.env.ENABLE_HELMET, true),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    },

    performance: {
      slowQueryThreshold: parseNumber(process.env.SLOW_QUERY_THRESHOLD, 1000),
      enableQueryOptimization: parseBoolean(process.env.ENABLE_QUERY_OPTIMIZATION, true),
      batchSize: parseNumber(process.env.BATCH_SIZE, 1000),
    },

    externalServices: {
      freelancer: {
        enabled: parseBoolean(process.env.FREELANCER_ENABLED, true),
        apiUrl: process.env.FREELANCER_API_URL || 'https://www.freelancer.com/api',
      },
      remoteJobs: {
        enabled: parseBoolean(process.env.REMOTE_JOBS_ENABLED, true),
        providers: parseArray(process.env.REMOTE_JOB_PROVIDERS, [
          'weworkremotely',
          'remotive',
          'himalayas',
        ]),
      },
      ozbargain: {
        enabled: parseBoolean(process.env.OZBARGAIN_ENABLED, true),
        apiUrl: process.env.OZBARGAIN_API_URL || 'https://www.ozbargain.com.au',
        cacheDeals: parseBoolean(process.env.OZBARGAIN_CACHE_DEALS, true),
      },
    },
  };

  // Validate and parse config
  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid configuration');
  }
}

/**
 * Global configuration instance
 */
export const config = loadConfig();

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof Config['features']): boolean {
  return config.features[feature];
}

/**
 * Check if caching is enabled
 */
export function isCachingEnabled(): boolean {
  return config.cache.enabled && config.app.enableCaching;
}

/**
 * Get cache TTL for a specific type
 */
export function getCacheTtl(type: 'short' | 'medium' | 'long' | 'extended' = 'medium'): number {
  return config.cache[`${type}Ttl`];
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return config.env === 'development';
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return config.env === 'production';
}

/**
 * Check if we're in test mode
 */
export function isTest(): boolean {
  return config.env === 'test';
}

/**
 * Export config as default
 */
export default config;
