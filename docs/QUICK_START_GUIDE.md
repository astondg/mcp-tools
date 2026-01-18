# Quick Start Guide - Using the New Best Practice Utilities

This guide shows you how to quickly start using the new best practice utilities in your MCP Tools project.

## Table of Contents

1. [Setup](#setup)
2. [Error Handling](#error-handling)
3. [Validation](#validation)
4. [Caching](#caching)
5. [Logging](#logging)
6. [Configuration](#configuration)
7. [Testing](#testing)

---

## Setup

### 1. Install Dependencies

```bash
npm install pino pino-pretty
npm install -D vitest @vitest/coverage-v8
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables to set:
```env
# Cache TTLs
CACHE_DEFAULT_TTL=300
CACHE_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_PRETTY=true

# Feature flags
FEATURE_TRIP_PLANNING=true
FEATURE_BUDGET_TRACKING=true
```

### 3. Run Tests

```bash
npm run test
```

---

## Error Handling

### Basic Usage

```typescript
import { McpToolError, ErrorCode, handleQueryError } from '@/lib/shared/errors';

// Throw custom error
export async function getTrip(id: string) {
  const trip = await prisma.trip.findUnique({ where: { id } });

  if (!trip) {
    throw new McpToolError(ErrorCode.NOT_FOUND, 'Trip not found');
  }

  return trip;
}

// Handle Prisma errors automatically
export async function updateTrip(id: string, data: any) {
  try {
    return await prisma.trip.update({ where: { id }, data });
  } catch (error) {
    throw handleQueryError(error, 'updateTrip');
  }
}
```

### Helper Functions

```typescript
import { notFoundError, validationError, duplicateError } from '@/lib/shared/errors';

// Not found
throw notFoundError('Trip', tripId);

// Validation
throw validationError('End date must be after start date', { field: 'endDate' });

// Duplicate
throw duplicateError('Trip', 'name');
```

### Error Response Format

All errors return consistent JSON:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Trip not found",
    "details": { "id": "123" }
  }
}
```

---

## Validation

### Common Schemas

```typescript
import {
  UuidSchema,
  DateSchema,
  DateRangeSchema,
  MoneySchema,
  NameSchema,
  EmailSchema,
  CurrencySchema,
} from '@/lib/shared/validation/common';

// Create your schema
const CreateTripSchema = z.object({
  name: NameSchema,              // 1-100 chars, trimmed
  destination: NameSchema,
  startDate: DateSchema,         // YYYY-MM-DD format
  endDate: DateSchema,
  budget: MoneySchema.optional(), // 0-9,999,999.99
  currency: CurrencySchema,       // 3-letter code, default AUD
});

// Use in function
export async function createTrip(params: unknown) {
  const validated = CreateTripSchema.parse(params);
  return await prisma.trip.create({ data: validated });
}
```

### Date Range Validation

```typescript
import { DateRangeSchema } from '@/lib/shared/validation/common';

// Automatically validates end >= start
const QuerySchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
);

// Or use the pre-built schema
const QuerySchema = DateRangeSchema;
```

### JSON Field Validation

```typescript
import { JsonFieldHelpers, TravellerSchema } from '@/lib/shared/validation/json';

// Parse from database
const trip = await prisma.trip.findUnique({ where: { id } });
const travellers = JsonFieldHelpers.parseTravellers(trip.travellers);
// Returns: Traveller[] | null (validated)

// Stringify for database
const travellersJson = JsonFieldHelpers.stringifyTravellers([
  { name: 'Aston', age: 35 },
  { name: 'Partner', age: 33 },
]);
// Returns: string | null (validated before stringifying)

// Store in database
await prisma.trip.update({
  where: { id },
  data: { travellers: travellersJson },
});
```

### Available JSON Helpers

```typescript
JsonFieldHelpers.parseTravellers(value)     // Traveller[]
JsonFieldHelpers.parseTags(value)           // string[]
JsonFieldHelpers.parseLocation(value)       // Location
JsonFieldHelpers.parseContact(value)        // Contact
JsonFieldHelpers.parseBooking(value)        // BookingConfirmation
JsonFieldHelpers.parseProsConsArray(value)  // string[]
JsonFieldHelpers.parseMetadata(value)       // Record<string, any>
```

---

## Caching

### Basic Caching

```typescript
import { getCached, CacheKeys, CachePresets } from '@/lib/shared/cache';

export async function getTripStatus(tripId: string) {
  return getCached(
    CacheKeys.trip.status(tripId),  // Cache key
    async () => {
      // Expensive calculation
      const items = await prisma.tripItem.findMany({ where: { tripId } });
      return calculateStatus(items);
    },
    CachePresets.medium() // 5 minutes TTL
  );
}
```

### Cache Invalidation

```typescript
import { invalidateCache, CacheKeys } from '@/lib/shared/cache';

export async function updateTripItem(id: string, data: any) {
  const item = await prisma.tripItem.update({ where: { id }, data });

  // Invalidate related caches
  await invalidateCache(CacheKeys.trip.status(item.tripId));
  await invalidateCache(CacheKeys.trip.budget(item.tripId));

  return item;
}
```

### Cache Presets

```typescript
import { CachePresets } from '@/lib/shared/cache';

CachePresets.short()     // 1 minute
CachePresets.medium()    // 5 minutes (default)
CachePresets.long()      // 30 minutes
CachePresets.extended()  // 1 hour
CachePresets.swr()       // Stale-while-revalidate
```

### Pre-configured Cache Keys

```typescript
import { CacheKeys } from '@/lib/shared/cache';

// Trip keys
CacheKeys.trip.status(tripId)
CacheKeys.trip.budget(tripId)
CacheKeys.trip.timeline(tripId)
CacheKeys.trip.packing(tripId)

// Budget keys
CacheKeys.budget.summary(period, startDate)
CacheKeys.budget.annual(year)

// Fitness keys
CacheKeys.fitness.progressSummary()
CacheKeys.fitness.weeklySummary(weekStart)
```

### Stale-While-Revalidate

```typescript
import { getCachedSWR, CacheKeys } from '@/lib/shared/cache';

// Returns stale data immediately, revalidates in background
const status = await getCachedSWR(
  CacheKeys.trip.status(tripId),
  async () => await calculateStatus(tripId),
  { ttl: 300, staleTime: 60 } // 5min cache, 1min stale
);
```

---

## Logging

### Basic Logging

```typescript
import { logger } from '@/lib/shared/logger';

// Info
logger.info({ userId: '123' }, 'User logged in');

// Error with context
logger.error({ error, tripId }, 'Failed to create trip');

// Warning
logger.warn({ count: 0 }, 'No results found');

// Debug (only in development)
logger.debug({ params }, 'Processing request');
```

### Tool Logging (Automatic Timing)

```typescript
import { createToolLogger } from '@/lib/shared/logger';

const toolLogger = createToolLogger('trip_create');

export async function handleTripCreate(params: any) {
  // Automatically logs start, duration, and errors
  return await toolLogger.execute(
    async () => {
      return await createTrip(params);
    },
    params
  );
}
```

### Performance Logging

```typescript
import { logTimed, logPerformance } from '@/lib/shared/logger';

// Option 1: Wrapper function
const result = await logTimed(
  'calculateBudgetSummary',
  async () => {
    return await expensiveCalculation();
  }
);

// Option 2: Manual timing
const start = Date.now();
const result = await doWork();
logPerformance('doWork', Date.now() - start, 1000); // Warns if >1000ms
```

### Specialized Logging

```typescript
import { logQuery, logCache, logEvent } from '@/lib/shared/logger';

// Query logging
logQuery('findMany', 'trips', 45, { userId: '123' });

// Cache logging
logCache('trip:123:status', true, 5); // hit=true, 5ms

// Business events
logEvent('trip_created', { tripId, userId });
```

---

## Configuration

### Access Configuration

```typescript
import { config } from '@/lib/shared/config';

// Type-safe access
const maxResults = config.app.maxQueryResults;     // number
const defaultCurrency = config.app.defaultCurrency; // string
const cacheTtl = config.cache.mediumTtl;           // number
```

### Feature Flags

```typescript
import { isFeatureEnabled } from '@/lib/shared/config';

if (isFeatureEnabled('tripPlanning')) {
  registerTripTools(server);
}

if (isFeatureEnabled('collaboration')) {
  enableCollaborationFeatures();
}
```

### Environment Checks

```typescript
import { isDevelopment, isProduction, isTest } from '@/lib/shared/config';

if (isDevelopment()) {
  enableDebugMode();
}

if (isProduction()) {
  enablePerformanceMonitoring();
}
```

### Cache TTL Helpers

```typescript
import { getCacheTtl } from '@/lib/shared/config';

const ttl = getCacheTtl('medium');  // 300 seconds
const shortTtl = getCacheTtl('short'); // 60 seconds
const longTtl = getCacheTtl('long');   // 1800 seconds
```

---

## Testing

### Write Tests

```typescript
// tests/lib/trip/trips.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/shared/db';
import { createTrip, getTrip } from '@/lib/trip/queries/trips';

describe('Trip Management', () => {
  beforeEach(async () => {
    // Database is cleaned automatically by setup.ts
  });

  it('should create a trip', async () => {
    const trip = await createTrip({
      name: 'London Trip',
      destination: 'London, UK',
      startDate: '2026-12-17',
      endDate: '2027-01-03',
    });

    expect(trip).toBeDefined();
    expect(trip.name).toBe('London Trip');
    expect(trip.status).toBe('PLANNING');
  });

  it('should throw error for invalid dates', async () => {
    await expect(
      createTrip({
        name: 'Invalid Trip',
        destination: 'Anywhere',
        startDate: '2026-12-17',
        endDate: '2026-12-10', // Before start!
      })
    ).rejects.toThrow('End date must be after start date');
  });
});
```

### Run Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm run test tests/lib/trip/trips.test.ts
```

### Test Database Cleanup

Database is automatically cleaned before each test in `tests/setup.ts`. Add new tables there if needed:

```typescript
beforeEach(async () => {
  await prisma.yourNewTable.deleteMany();
});
```

---

## Complete Example

Here's a complete example using all the utilities:

```typescript
// src/lib/trip/queries/trips.ts
import { z } from 'zod';
import { prisma, withRetry } from '@/lib/shared/db';
import { McpToolError, ErrorCode, handleQueryError } from '@/lib/shared/errors';
import { NameSchema, DateSchema, MoneySchema } from '@/lib/shared/validation/common';
import { JsonFieldHelpers } from '@/lib/shared/validation/json';
import { getCached, invalidateCache, CacheKeys, CachePresets } from '@/lib/shared/cache';
import { logger, createToolLogger } from '@/lib/shared/logger';

// Validation schema
const CreateTripSchema = z.object({
  name: NameSchema,
  destination: NameSchema,
  startDate: DateSchema,
  endDate: DateSchema,
  budget: MoneySchema.optional(),
  travellers: z.array(z.object({
    name: NameSchema,
    age: z.number().min(0).max(120).optional(),
  })).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
);

type CreateTripParams = z.infer<typeof CreateTripSchema>;

// Create trip
export async function createTrip(params: unknown) {
  // Validate
  const validated = CreateTripSchema.parse(params);

  logger.info({ tripName: validated.name }, 'Creating trip');

  try {
    // Create with retry
    const trip = await withRetry(
      () => prisma.trip.create({
        data: {
          ...validated,
          travellers: JsonFieldHelpers.stringifyTravellers(validated.travellers),
        },
      })
    );

    logger.info({ tripId: trip.id }, 'Trip created successfully');
    return trip;
  } catch (error) {
    logger.error({ error, params: validated }, 'Failed to create trip');
    throw handleQueryError(error, 'createTrip');
  }
}

// Get trip with caching
export async function getTrip(id: string) {
  return getCached(
    `trip:${id}`,
    async () => {
      const trip = await prisma.trip.findUnique({ where: { id } });

      if (!trip) {
        throw new McpToolError(ErrorCode.NOT_FOUND, 'Trip not found');
      }

      return {
        ...trip,
        travellers: JsonFieldHelpers.parseTravellers(trip.travellers),
      };
    },
    CachePresets.medium()
  );
}

// Update trip (with cache invalidation)
export async function updateTrip(id: string, data: Partial<CreateTripParams>) {
  const validated = CreateTripSchema.partial().parse(data);

  try {
    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...validated,
        ...(validated.travellers && {
          travellers: JsonFieldHelpers.stringifyTravellers(validated.travellers),
        }),
      },
    });

    // Invalidate caches
    await invalidateCache(`trip:${id}`);
    await invalidateCache(CacheKeys.trip.status(id));

    return trip;
  } catch (error) {
    throw handleQueryError(error, 'updateTrip');
  }
}

// Tool wrapper with logging
const toolLogger = createToolLogger('trip_create');

export async function handleTripCreateTool(params: unknown) {
  return await toolLogger.execute(
    () => createTrip(params),
    params
  );
}
```

---

## Tips & Best Practices

### 1. Always Validate Input

```typescript
// ✅ Good
const validated = CreateTripSchema.parse(params);

// ❌ Bad
const trip = await createTrip(params); // No validation
```

### 2. Use Cache for Expensive Queries

```typescript
// ✅ Good - Cached
return getCached(key, () => expensiveQuery(), CachePresets.medium());

// ❌ Bad - Every time hits database
return await expensiveQuery();
```

### 3. Invalidate Caches on Updates

```typescript
// ✅ Good
await updateTrip(id, data);
await invalidateCache(`trip:${id}`);

// ❌ Bad - Stale cache
await updateTrip(id, data);
```

### 4. Use Structured Logging

```typescript
// ✅ Good
logger.info({ tripId, userId }, 'Trip created');

// ❌ Bad
console.log('Trip created:', tripId, userId);
```

### 5. Handle Errors Consistently

```typescript
// ✅ Good
try {
  return await operation();
} catch (error) {
  throw handleQueryError(error, 'operation');
}

// ❌ Bad
try {
  return await operation();
} catch (error) {
  throw new Error(error.message);
}
```

---

## Need Help?

- See `IMPLEMENTATION_SUMMARY.md` for full details
- Check test files in `tests/` for examples
- Review code review document: `mcp-tools-code-review.md`
