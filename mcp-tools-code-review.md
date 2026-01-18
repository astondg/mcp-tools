# MCP Tools - Comprehensive Code Review & Improvements

## Executive Summary

After implementing the trip planning system, I've conducted a full code review of the MCP tools codebase. This document identifies areas for improvement and provides specific recommendations following 2026 modern best practices.

## 1. Schema Organization 🔧

### Issue: Single Large Schema File
**Current**: All models in one `schema.prisma` file (now ~1300+ lines with trip planning)

**Problem**:
- Hard to navigate
- Merge conflicts likely
- Cognitive overload
- Slow schema regeneration

**Recommendation**: ⚠️ **Cannot Split in Prisma**

Unfortunately, Prisma **does not support multiple schema files** as of 2026. The entire schema must be in one file.

**Mitigation Strategies**:

1. **Better Organization** (IMPLEMENTED):
   ```prisma
   // ==========================================
   // System Name
   // ==========================================

   // Clear section headers
   // Logical grouping
   // Consistent ordering (enums → models)
   ```

2. **Schema Validation Tool**:
   ```bash
   # Add to package.json scripts
   "schema:validate": "npx prisma validate",
   "schema:format": "npx prisma format"
   ```

3. **Documentation**:
   Create `/docs/schema-guide.md` with:
   - Overview of each system
   - Table relationship diagrams
   - Common query patterns
   - Migration guide

4. **Future**: Watch for [Prisma Schema Modules RFC](https://github.com/prisma/prisma/issues/2377)

**Impact**: 🟡 Medium - Inconvenient but not blocking

---

## 2. Code Structure & Modularity 📁

### Issue: Flat lib/ Structure

**Current**:
```
src/lib/
  ├── budget/
  │   ├── queries.ts (1000+ lines)
  │   └── types.ts
  ├── fitness/
  │   └── queries.ts (1500+ lines)
  ├── vehicle/
  │   └── queries.ts
  └── trip/
      ├── queries.ts (will be 2000+ lines)
      └── types.ts
```

**Problems**:
- Query files are getting very large
- Mixing different concerns (CRUD, summaries, analytics)
- Hard to find specific functions
- Testing becomes difficult

**Recommendation**: ✅ **Split Query Files by Feature**

**Proposed Structure**:
```
src/lib/
  ├── budget/
  │   ├── types.ts
  │   ├── queries/
  │   │   ├── index.ts (re-exports)
  │   │   ├── categories.ts
  │   │   ├── expenses.ts
  │   │   ├── income.ts
  │   │   ├── summaries.ts
  │   │   └── analytics.ts
  │   └── utils/
  │       ├── dateUtils.ts
  │       └── calculations.ts
  ├── fitness/
  │   ├── types.ts
  │   ├── queries/
  │   │   ├── index.ts
  │   │   ├── goals.ts
  │   │   ├── programs.ts
  │   │   ├── workouts.ts
  │   │   └── nutrition.ts
  │   └── utils/
  │       └── calculations.ts
  ├── trip/
  │   ├── types.ts
  │   ├── queries/
  │   │   ├── index.ts
  │   │   ├── trips.ts
  │   │   ├── items.ts
  │   │   ├── itineraries.ts
  │   │   ├── packing.ts
  │   │   ├── reminders.ts
  │   │   └── summaries.ts
  │   └── utils/
  │       ├── dateUtils.ts
  │       ├── budgetUtils.ts
  │       └── locationUtils.ts
  └── shared/
      ├── db.ts
      ├── redis.ts
      └── utils/
          ├── decimal.ts
          └── validation.ts
```

**Benefits**:
- ✅ Each file < 300 lines
- ✅ Clear separation of concerns
- ✅ Easier to test individual features
- ✅ Better code navigation
- ✅ Parallel development possible

**Migration Strategy**:
1. Create new structure alongside old
2. Move functions one feature at a time
3. Update imports
4. Add deprecation warnings
5. Remove old files after testing

**Impact**: 🟢 High value - Significantly improves maintainability

---

## 3. Type Safety & Validation ✨

### Issue: JSON Field Handling

**Current**:
```typescript
// In schema
travellers  String?  // JSON array
tags        String?  // JSON array
pros        String?  // JSON array

// In queries - Manual JSON parse/stringify
travellers: params.travellers ? JSON.stringify(params.travellers) : null
```

**Problems**:
- Type safety lost when parsing JSON
- No validation of JSON structure
- Runtime errors if malformed
- Inconsistent parsing/stringifying

**Recommendation**: ✅ **Zod Schemas for JSON Fields**

```typescript
// In types.ts
import { z } from 'zod';

export const TravellerSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  birthday: z.string().optional(),
  notes: z.string().optional(),
});

export const TagSchema = z.array(z.string());
export const ProsConsSchema = z.array(z.string());

export type Traveller = z.infer<typeof TravellerSchema>;

// In queries.ts
import { TravellerSchema } from './types';

function parseJsonField<T>(value: string | null, schema: z.ZodSchema<T>): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return schema.parse(parsed); // Validates structure
  } catch (e) {
    console.error('JSON parse error:', e);
    return null;
  }
}

function stringifyJsonField<T>(value: T | null, schema: z.ZodSchema<T>): string | null {
  if (!value) return null;
  const validated = schema.parse(value); // Validates before storing
  return JSON.stringify(validated);
}

// Usage
const travellersParsed = parseJsonField(trip.travellers, z.array(TravellerSchema));
```

**Benefits**:
- ✅ Runtime validation
- ✅ Type safety maintained
- ✅ Clear error messages
- ✅ Consistent handling

**Impact**: 🟢 High value - Prevents runtime errors

---

## 4. Error Handling 🚨

### Issue: Inconsistent Error Responses

**Current**:
```typescript
// Different error formats across tools
throw new Error('Category not found');
return { error: 'Invalid date range' };
return { success: false, message: '...' };
```

**Problems**:
- Claude sees different error formats
- Hard to handle errors consistently
- No error codes for programmatic handling
- Missing error context

**Recommendation**: ✅ **Standardized Error Class**

```typescript
// src/lib/shared/errors.ts
export class McpToolError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: unknown,
    public httpStatus: number = 400
  ) {
    super(message);
    this.name = 'McpToolError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

// Error codes enum
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  DUPLICATE = 'DUPLICATE',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

// src/lib/shared/errorHandler.ts
export function handleQueryError(error: unknown, context: string) {
  if (error instanceof McpToolError) {
    throw error; // Re-throw custom errors
  }

  // Prisma errors
  if (error.code === 'P2002') {
    throw new McpToolError(
      ErrorCode.DUPLICATE,
      `Duplicate ${context} found`,
      { constraint: error.meta?.target }
    );
  }

  if (error.code === 'P2025') {
    throw new McpToolError(
      ErrorCode.NOT_FOUND,
      `${context} not found`
    );
  }

  // Generic error
  throw new McpToolError(
    ErrorCode.DATABASE_ERROR,
    `Error in ${context}`,
    error,
    500
  );
}

// Usage in queries
export async function getTrip(id: string) {
  try {
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      throw new McpToolError(ErrorCode.NOT_FOUND, 'Trip not found');
    }
    return trip;
  } catch (error) {
    throw handleQueryError(error, 'getTrip');
  }
}
```

**Benefits**:
- ✅ Consistent error format
- ✅ Error codes for handling
- ✅ Better debugging
- ✅ Proper HTTP status codes

**Impact**: 🟢 High value - Better error handling

---

## 5. Testing Infrastructure 🧪

### Issue: No Test Suite

**Current**: No tests at all

**Problems**:
- Can't verify behavior
- Refactoring is risky
- Bugs caught in production
- No regression testing

**Recommendation**: ✅ **Add Jest + Vitest Testing**

```typescript
// package.json additions
{
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "vitest": "^1.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}

// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});

// tests/lib/trip/trips.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTrip, getTrip } from '@/lib/trip/queries/trips';
import { prisma } from '@/lib/shared/db';

describe('Trip Management', () => {
  beforeEach(async () => {
    await prisma.trip.deleteMany(); // Clean slate
  });

  describe('createTrip', () => {
    it('should create a trip with required fields', async () => {
      const trip = await createTrip({
        name: 'London Christmas 2026',
        destination: 'London, UK',
        startDate: new Date('2026-12-17'),
        endDate: new Date('2027-01-03'),
      });

      expect(trip.id).toBeDefined();
      expect(trip.name).toBe('London Christmas 2026');
      expect(trip.status).toBe('PLANNING');
    });

    it('should validate date range', async () => {
      await expect(
        createTrip({
          name: 'Invalid Trip',
          destination: 'Anywhere',
          startDate: new Date('2026-12-17'),
          endDate: new Date('2026-12-10'), // Before start!
        })
      ).rejects.toThrow('End date must be after start date');
    });
  });

  describe('getTrip', () => {
    it('should return trip with items when included', async () => {
      const trip = await createTrip({...});
      await addTripItem({ tripId: trip.id, ... });

      const retrieved = await getTrip(trip.id, { includeItems: true });

      expect(retrieved.items).toHaveLength(1);
    });

    it('should throw NOT_FOUND for non-existent trip', async () => {
      await expect(
        getTrip('non-existent-id')
      ).rejects.toThrow('Trip not found');
    });
  });
});

// tests/lib/budget/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { annualizeBudget, getPeriodDateRange } from '@/lib/budget/utils/calculations';

describe('Budget Calculations', () => {
  it('should annualize weekly budget correctly', () => {
    expect(annualizeBudget(100, 'WEEKLY')).toBe(5200);
  });

  it('should get correct date range for monthly period', () => {
    const { start, end } = getPeriodDateRange('MONTHLY', new Date('2026-01-15'));
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
  });
});
```

**Test Coverage Targets**:
- Unit tests: 80%+ coverage
- Integration tests for critical paths
- E2E tests for main workflows

**Impact**: 🟢 Critical - Enables confident refactoring

---

## 6. Database Connection Handling 💾

### Issue: Missing Connection Pool Configuration

**Current**:
```typescript
// src/lib/db.ts or similar
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

**Problems**:
- No connection pooling configuration
- May hit connection limits
- No retry logic
- No query logging in development

**Recommendation**: ✅ **Enhanced Prisma Configuration**

```typescript
// src/lib/shared/db.ts
import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };

// Optional: Query retry wrapper
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return withRetry(fn, retries - 1);
    }
    throw error;
  }
}

function isRetryableError(error: unknown): boolean {
  // Prisma timeout errors, connection issues, etc.
  return error.code === 'P1001' || error.code === 'P1002';
}
```

**Benefits**:
- ✅ Proper connection pooling (Neon handles this, but good to configure)
- ✅ Query logging in development
- ✅ Graceful shutdown
- ✅ Retry logic for transient errors

**Impact**: 🟡 Medium - Improves reliability

---

## 7. Caching Strategy 📦

### Issue: No Caching Layer

**Current**: Every request hits database

**Problems**:
- Slow responses for summaries
- Unnecessary database load
- API rate limit concerns
- Cost implications

**Recommendation**: ✅ **Redis Caching for Summaries**

You already have Redis (`@upstash/redis`), use it!

```typescript
// src/lib/shared/cache.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try cache first
  const cached = await redis.get<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch and cache
  const data = await fetcher();
  await redis.setex(key, ttlSeconds, data);
  return data;
}

export async function invalidateCache(pattern: string) {
  // For Upstash, we need to track keys manually or use a prefix pattern
  await redis.del(pattern);
}

// Usage in queries
export async function getTripStatus(tripId: string) {
  return getCached(
    `trip:${tripId}:status`,
    async () => {
      // Expensive aggregation query
      const items = await prisma.tripItem.findMany({ where: { tripId } });
      // ... calculate status
      return status;
    },
    300 // 5 minutes
  );
}

// Invalidate on updates
export async function updateTripItem(id: string, data: UpdateData) {
  const item = await prisma.tripItem.update({ where: { id }, data });

  // Invalidate related caches
  await invalidateCache(`trip:${item.tripId}:status`);
  await invalidateCache(`trip:${item.tripId}:budget`);

  return item;
}
```

**Cache Candidates**:
- `trip_get_status` - 5 min cache
- `trip_budget_summary` - 5 min cache
- `trip_timeline` - 5 min cache
- `budget_get_summary` - 5 min cache
- `fitness_get_progress_summary` - 10 min cache

**Benefits**:
- ✅ Faster responses
- ✅ Reduced database load
- ✅ Better scalability

**Impact**: 🟢 High value - Performance boost

---

## 8. MCP Tool Organization 🛠️

### Issue: Growing Tool Registration Files

**Current**:
```typescript
// src/app/api/mcp/tools/budget.ts (500+ lines)
// All tools in one file
```

**With trip planning**:
```typescript
// src/app/api/mcp/tools/trip.ts (will be 1500+ lines)
// 54 tools in one file!
```

**Recommendation**: ✅ **Split Tool Registration by Feature**

```
src/app/api/mcp/tools/
  ├── budget/
  │   ├── index.ts (re-exports registerBudgetTools)
  │   ├── categories.ts
  │   ├── expenses.ts
  │   ├── income.ts
  │   └── summaries.ts
  ├── trip/
  │   ├── index.ts (re-exports registerTripTools)
  │   ├── trips.ts
  │   ├── items.ts
  │   ├── itineraries.ts
  │   ├── packing.ts
  │   ├── reminders.ts
  │   └── summaries.ts
  ├── fitness/
  │   ├── index.ts
  │   ├── goals.ts
  │   ├── programs.ts
  │   └── workouts.ts
  └── types.ts (shared)

// trip/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTripManagementTools } from './trips';
import { registerTripItemTools } from './items';
import { registerItineraryTools } from './itineraries';
import { registerPackingTools } from './packing';

export function registerTripTools(server: McpServer) {
  registerTripManagementTools(server);
  registerTripItemTools(server);
  registerItineraryTools(server);
  registerPackingTools(server);
}
```

**Benefits**:
- ✅ Manageable file sizes
- ✅ Clear organization
- ✅ Easier to locate tools
- ✅ Better code review diffs

**Impact**: 🟢 High value - Maintainability

---

## 9. Input Validation Consistency 🔐

### Issue: Validation Scattered Across Files

**Current**:
```typescript
// Sometimes in queries
if (!params.name || params.name.length === 0) throw new Error('...');

// Sometimes in tools
z.string().min(1).max(100)

// Sometimes missing!
```

**Recommendation**: ✅ **Shared Zod Schemas**

```typescript
// src/lib/shared/validation/common.ts
import { z } from 'zod';

export const UuidSchema = z.string().uuid('Invalid ID format');

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const MoneySchema = z.number().min(0).max(9999999.99);

export const NameSchema = z.string().min(1).max(100).trim();

export const NotesSchema = z.string().max(5000).optional();

export const EmailSchema = z.string().email();

export const PhoneSchema = z.string().regex(/^\+?[\d\s-()]+$/).optional();

// src/lib/trip/validation/schemas.ts
import { z } from 'zod';
import { UuidSchema, DateSchema, MoneySchema, NameSchema } from '@/lib/shared/validation/common';
import { TripStatus, TripItemType } from '@prisma/client';

export const CreateTripSchema = z.object({
  name: NameSchema,
  destination: NameSchema,
  startDate: DateSchema,
  endDate: DateSchema,
  budgetTotal: MoneySchema.optional(),
  currency: z.string().length(3).default('AUD'),
  travellers: z.array(z.object({
    name: NameSchema,
    age: z.number().min(0).max(120).optional(),
    notes: z.string().max(500).optional(),
  })).optional(),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const AddTripItemSchema = z.object({
  tripId: UuidSchema,
  type: z.nativeEnum(TripItemType),
  name: NameSchema,
  date: DateSchema.optional(),
  costEstimate: MoneySchema.optional(),
  // ... other fields
});

// Usage in tools
server.tool('trip_create', 'Create a new trip', CreateTripSchema.shape, async (params) => {
  const validated = CreateTripSchema.parse(params); // Already validated by Zod
  return await createTrip(validated);
});

// Usage in queries
export async function createTrip(data: z.infer<typeof CreateTripSchema>) {
  // Data is already validated, types are inferred
  return await prisma.trip.create({ data: {...} });
}
```

**Benefits**:
- ✅ Single source of truth
- ✅ Consistent validation
- ✅ Type inference
- ✅ Better error messages
- ✅ Reusable across tools

**Impact**: 🟢 High value - Data integrity

---

## 10. Documentation 📚

### Issue: Minimal Documentation

**Current**:
- No API docs
- No usage examples
- No migration guides
- Comments are sparse

**Recommendation**: ✅ **Comprehensive Documentation**

```
docs/
  ├── README.md (Overview)
  ├── getting-started.md
  ├── architecture.md
  ├── api/
  │   ├── budget.md (All budget tools with examples)
  │   ├── trip.md
  │   ├── fitness.md
  │   └── vehicle.md
  ├── guides/
  │   ├── trip-planning-workflow.md
  │   ├── budget-integration.md
  │   └── testing.md
  ├── schema/
  │   ├── overview.md
  │   ├── relationships.md (Diagram)
  │   └── migration-guide.md
  └── examples/
      ├── london-trip.md (Full walkthrough)
      ├── weekend-getaway.md
      └── monthly-budgeting.md

// Example: docs/api/trip.md
# Trip Planning API

## trip_create

Create a new trip.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Trip name (1-100 chars) |
| destination | string | Yes | Destination (e.g., "London, UK") |
| startDate | string | Yes | Start date (YYYY-MM-DD) |
| endDate | string | Yes | End date (YYYY-MM-DD) |
| budgetTotal | number | No | Total budget |
| currency | string | No | Currency code (default: AUD) |

### Example

\`\`\`json
{
  "name": "London Christmas 2026",
  "destination": "London, UK",
  "startDate": "2026-12-17",
  "endDate": "2027-01-03",
  "budgetTotal": 25000,
  "currency": "AUD",
  "travellers": [
    { "name": "Aston", "age": 35 },
    { "name": "Wife", "age": 33 },
    { "name": "Daughter", "age": 4, "birthday": "2021-12-29" }
  ]
}
\`\`\`

### Response

\`\`\`json
{
  "id": "uuid",
  "name": "London Christmas 2026",
  "status": "PLANNING",
  "createdAt": "2026-01-18T12:00:00Z",
  ...
}
\`\`\`

### Errors

| Code | Message | Description |
|------|---------|-------------|
| INVALID_INPUT | End date must be after start date | Date validation failed |
| DUPLICATE | Trip with this name already exists | Name conflict |
```

**Impact**: 🟢 High value - Usability

---

## 11. Environment & Configuration 🔧

### Issue: Hard-coded Values

**Current**:
```typescript
const DEFAULT_CURRENCY = 'AUD';
const MAX_RESULTS = 100;
const CACHE_TTL = 300;
```

**Recommendation**: ✅ **Environment-based Configuration**

```typescript
// .env
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Application Config
DEFAULT_CURRENCY=AUD
MAX_QUERY_RESULTS=100
CACHE_TTL_SECONDS=300
ENABLE_QUERY_LOGGING=true
ENABLE_CACHING=true

# Feature Flags
FEATURE_TRIP_PLANNING=true
FEATURE_BUDGET_SCENARIOS=true
FEATURE_COLLABORATION=false

// src/lib/shared/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  database: z.object({
    url: z.string().url(),
    unpooledUrl: z.string().url(),
  }),
  redis: z.object({
    url: z.string().url(),
    token: z.string(),
  }),
  app: z.object({
    defaultCurrency: z.string().length(3).default('AUD'),
    maxQueryResults: z.number().int().positive().default(100),
    cacheTtlSeconds: z.number().int().positive().default(300),
    enableQueryLogging: z.boolean().default(false),
    enableCaching: z.boolean().default(true),
  }),
  features: z.object({
    tripPlanning: z.boolean().default(true),
    budgetScenarios: z.boolean().default(true),
    collaboration: z.boolean().default(false),
  }),
});

function loadConfig() {
  return ConfigSchema.parse({
    database: {
      url: process.env.DATABASE_URL,
      unpooledUrl: process.env.DATABASE_URL_UNPOOLED,
    },
    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    app: {
      defaultCurrency: process.env.DEFAULT_CURRENCY,
      maxQueryResults: parseInt(process.env.MAX_QUERY_RESULTS || '100'),
      cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
      enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
      enableCaching: process.env.ENABLE_CACHING === 'true',
    },
    features: {
      tripPlanning: process.env.FEATURE_TRIP_PLANNING === 'true',
      budgetScenarios: process.env.FEATURE_BUDGET_SCENARIOS === 'true',
      collaboration: process.env.FEATURE_COLLABORATION === 'true',
    },
  });
}

export const config = loadConfig();

// Usage
import { config } from '@/lib/shared/config';

const currency = config.app.defaultCurrency;
if (config.features.tripPlanning) {
  registerTripTools(server);
}
```

**Impact**: 🟡 Medium - Flexibility

---

## 12. Logging & Observability 📊

### Issue: Console.log for Debugging

**Current**:
```typescript
console.log('Creating trip:', params);
console.error('Error:', error);
```

**Recommendation**: ✅ **Structured Logging**

```typescript
// src/lib/shared/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

// Usage
import { logger } from '@/lib/shared/logger';

export async function createTrip(data: CreateTripData) {
  logger.info({ tripName: data.name }, 'Creating trip');

  try {
    const trip = await prisma.trip.create({ data });
    logger.info({ tripId: trip.id }, 'Trip created successfully');
    return trip;
  } catch (error) {
    logger.error({ error, data }, 'Failed to create trip');
    throw error;
  }
}

// For MCP tools
server.tool('trip_create', 'Create trip', schema, async (params) => {
  const startTime = Date.now();

  try {
    const result = await createTrip(params);

    logger.info({
      tool: 'trip_create',
      duration: Date.now() - startTime,
      tripId: result.id,
    }, 'Tool completed');

    return result;
  } catch (error) {
    logger.error({
      tool: 'trip_create',
      duration: Date.now() - startTime,
      error,
    }, 'Tool failed');

    throw error;
  }
});
```

**Benefits**:
- ✅ Structured logs
- ✅ Easy to parse/analyze
- ✅ Performance tracking
- ✅ Error tracking

**Impact**: 🟡 Medium - Production readiness

---

## 13. Security Considerations 🔒

### Issue: Missing Security Measures

**Potential Risks**:
- No rate limiting on MCP endpoints
- No input sanitization beyond Zod
- Shared links have no expiry
- No audit logging

**Recommendations**:

```typescript
// 1. Rate Limiting (using Upstash Redis)
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/shared/cache';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min
});

export async function rateLimitMiddleware(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new McpToolError(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)}s`,
      { limit, remaining, reset }
    );
  }
}

// 2. Input Sanitization
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }); // Strip all HTML
}

export const SanitizedStringSchema = z.string().transform(sanitizeHtml);

// 3. Trip Sharing with Expiry
model Trip {
  sharingLink       String?   @unique
  sharingExpiresAt  DateTime? @map("sharing_expires_at")
}

// 4. Audit Logging
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?  // Optional if not authenticated
  action    String   // "trip.create", "item.update"
  entityType String  @map("entity_type") // "trip", "item"
  entityId  String   @map("entity_id")
  changes   String?  // JSON of what changed
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

**Impact**: 🟡 Medium - Production security

---

## Priority Roadmap 🗺️

### Phase 1: Immediate (Before London Trip)
1. ✅ Complete trip planning schema (DONE)
2. 🔲 Split query files by feature
3. 🔲 Add Zod schemas for JSON fields
4. 🔲 Implement standardized errors
5. 🔲 Add basic caching for summaries

**Estimated Effort**: 1-2 weeks

### Phase 2: Short-term (Next Month)
1. 🔲 Add test suite (Vitest)
2. 🔲 Split MCP tool registration files
3. 🔲 Add structured logging
4. 🔲 Create API documentation

**Estimated Effort**: 2-3 weeks

### Phase 3: Medium-term (Next Quarter)
1. 🔲 Implement rate limiting
2. 🔲 Add audit logging
3. 🔲 Create configuration system
4. 🔲 Add input sanitization
5. 🔲 Performance optimization

**Estimated Effort**: 1 month

### Phase 4: Long-term (Future)
1. 🔲 Collaboration features
2. 🔲 External integrations (Google Calendar, Maps)
3. 🔲 Advanced AI features
4. 🔲 Mobile app
5. 🔲 Public API

**Estimated Effort**: Ongoing

---

## Metrics & Success Criteria 📈

### Code Quality Metrics
- ✅ Test coverage: >80%
- ✅ Average file size: <300 lines
- ✅ Function complexity: <10 cyclomatic complexity
- ✅ Type coverage: 100% (strict mode)

### Performance Metrics
- ✅ Query response time: <200ms (p95)
- ✅ Cache hit rate: >70%
- ✅ Database connection pool utilization: <50%

### Reliability Metrics
- ✅ Error rate: <0.1%
- ✅ Uptime: >99.9%
- ✅ Mean time to recovery: <5 minutes

---

## Conclusion

The MCP tools codebase is well-structured and follows modern practices, but could benefit from:

1. **Better organization** (split large files)
2. **Enhanced type safety** (Zod for JSON)
3. **Comprehensive testing** (Vitest)
4. **Improved error handling** (standardized errors)
5. **Caching layer** (Redis for summaries)
6. **Documentation** (API docs, guides)

The trip planning implementation follows these recommendations and serves as a template for refactoring existing systems.

**Key Takeaway**: The schema organization issue (single file) is unavoidable with Prisma, but all other improvements can be implemented incrementally without disrupting existing functionality.
