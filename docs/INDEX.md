# MCP Tools - Documentation Index

Welcome to the MCP Tools documentation! This index will help you navigate all available documentation.

## 📚 Core Documentation

### Getting Started

- **[README_BEST_PRACTICES.md](../README_BEST_PRACTICES.md)** - Overview of best practices implementation
- **[QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)** - Quick start guide with code examples
- **[IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)** - Detailed implementation documentation

### Code Review & Planning

- **[mcp-tools-code-review.md](../mcp-tools-code-review.md)** - Comprehensive code review and recommendations

## 🛠️ Implementation Guides

### 1. Error Handling

**File**: `src/lib/shared/errors.ts`

Learn how to:
- Throw standardized errors with error codes
- Handle Prisma errors automatically
- Create consistent error responses
- Use helper functions (notFoundError, validationError, etc.)

**Quick Example**:
```typescript
import { McpToolError, ErrorCode } from '@/lib/shared/errors';
throw new McpToolError(ErrorCode.NOT_FOUND, 'Trip not found');
```

---

### 2. Validation

**Files**:
- `src/lib/shared/validation/common.ts` - Common schemas
- `src/lib/shared/validation/json.ts` - JSON field schemas

Learn how to:
- Use pre-built validation schemas
- Create custom schemas with Zod
- Validate JSON fields safely
- Get TypeScript types from schemas

**Quick Example**:
```typescript
import { NameSchema, DateSchema } from '@/lib/shared/validation/common';
const schema = z.object({ name: NameSchema, date: DateSchema });
```

---

### 3. Caching

**File**: `src/lib/shared/cache.ts`

Learn how to:
- Cache expensive queries with Redis
- Use pre-configured cache keys
- Invalidate caches on updates
- Implement stale-while-revalidate

**Quick Example**:
```typescript
import { getCached, CacheKeys } from '@/lib/shared/cache';
const data = await getCached(CacheKeys.trip.status(id), fetchFn, { ttl: 300 });
```

---

### 4. Logging

**File**: `src/lib/shared/logger.ts`

Learn how to:
- Use structured logging
- Log with context and metadata
- Automatically time operations
- Use specialized log functions

**Quick Example**:
```typescript
import { logger, createToolLogger } from '@/lib/shared/logger';
logger.info({ userId }, 'User logged in');
```

---

### 5. Configuration

**File**: `src/lib/shared/config.ts`

Learn how to:
- Access type-safe configuration
- Use feature flags
- Configure environment variables
- Check environment (dev/prod/test)

**Quick Example**:
```typescript
import { config, isFeatureEnabled } from '@/lib/shared/config';
if (isFeatureEnabled('tripPlanning')) { /* ... */ }
```

---

### 6. Database

**File**: `src/lib/shared/db.ts`

Learn how to:
- Use Prisma with retry logic
- Handle transient errors
- Use query helpers
- Monitor database health

**Quick Example**:
```typescript
import { withRetry, QueryHelpers } from '@/lib/shared/db';
const data = await withRetry(() => prisma.trip.findMany());
```

---

### 7. Testing

**Files**:
- `vitest.config.ts` - Test configuration
- `tests/setup.ts` - Global test setup
- `tests/lib/shared/*.test.ts` - Example tests

Learn how to:
- Write unit tests with Vitest
- Test database operations
- Check test coverage
- Run tests in watch mode

**Quick Example**:
```bash
npm run test
npm run test:coverage
```

---

## 📖 Reference Documentation

### Available Schemas

#### Common Validation (`@/lib/shared/validation/common`)

| Schema | Type | Description |
|--------|------|-------------|
| `UuidSchema` | string | Valid UUID format |
| `DateSchema` | string | YYYY-MM-DD format |
| `DateTimeSchema` | string | ISO 8601 datetime |
| `MoneySchema` | number | 0 to 9,999,999.99 |
| `NameSchema` | string | 1-100 chars, trimmed |
| `EmailSchema` | string | Valid email, lowercased |
| `PhoneSchema` | string | International phone format |
| `UrlSchema` | string | Valid URL |
| `CurrencySchema` | string | 3-letter currency code |
| `DateRangeSchema` | object | Validated date range |
| `TagsSchema` | string[] | Array of tags |
| `CoordinatesSchema` | object | Lat/lng coordinates |

See `src/lib/shared/validation/common.ts` for all 30+ schemas.

#### JSON Field Schemas (`@/lib/shared/validation/json`)

| Schema | Type | Description |
|--------|------|-------------|
| `TravellerSchema` | object | Trip traveller info |
| `LocationSchema` | object | Address + coordinates |
| `ContactSchema` | object | Contact information |
| `BookingConfirmationSchema` | object | Booking details |
| `TagsSchema` | string[] | Tags array |
| `MetadataSchema` | Record | Flexible metadata |

See `src/lib/shared/validation/json.ts` for complete schemas.

---

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Invalid input data |
| `VALIDATION_ERROR` | 400 | Validation failed |
| `DUPLICATE` | 409 | Duplicate resource |
| `CONSTRAINT_VIOLATION` | 400 | Database constraint |
| `DATABASE_ERROR` | 500 | Database error |
| `INTERNAL_ERROR` | 500 | Internal server error |

See `src/lib/shared/errors.ts` for all error codes.

---

### Cache Keys

#### Trip Keys
```typescript
CacheKeys.trip.status(tripId)
CacheKeys.trip.budget(tripId)
CacheKeys.trip.timeline(tripId)
CacheKeys.trip.packing(tripId)
CacheKeys.trip.summary(tripId)
```

#### Budget Keys
```typescript
CacheKeys.budget.summary(period, startDate)
CacheKeys.budget.balance(period, startDate)
CacheKeys.budget.annual(year)
CacheKeys.budget.vsActuals(year)
```

#### Fitness Keys
```typescript
CacheKeys.fitness.progressSummary()
CacheKeys.fitness.weeklySummary(weekStart)
CacheKeys.fitness.goalProgress(goalId)
```

See `src/lib/shared/cache.ts` for all cache keys.

---

### Cache Presets

| Preset | TTL | Use Case |
|--------|-----|----------|
| `short()` | 60s | Frequently changing data |
| `medium()` | 300s | Default for most queries |
| `long()` | 1800s | Stable data |
| `extended()` | 3600s | Rarely changing data |
| `swr()` | Custom | Stale-while-revalidate |

---

### Configuration Options

#### Feature Flags
```typescript
FEATURE_TRIP_PLANNING=true
FEATURE_BUDGET_TRACKING=true
FEATURE_FITNESS_TRACKING=true
FEATURE_VEHICLE_MAINTENANCE=true
FEATURE_SHOPPING=true
FEATURE_BUDGET_SCENARIOS=true
FEATURE_COLLABORATION=false
```

#### Performance
```typescript
SLOW_QUERY_THRESHOLD=1000
ENABLE_QUERY_OPTIMIZATION=true
BATCH_SIZE=1000
```

#### Caching
```typescript
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300
CACHE_SHORT_TTL=60
CACHE_MEDIUM_TTL=300
CACHE_LONG_TTL=1800
```

See `.env.example` for all configuration options.

---

## 🧪 Testing Documentation

### Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm run test tests/lib/shared/errors.test.ts
```

### Test Files

- `tests/lib/shared/errors.test.ts` - Error handling tests
- `tests/lib/shared/validation.test.ts` - Validation tests
- `tests/example.budget.test.ts` - Budget system example tests

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/shared/db';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Database is cleaned automatically
  });

  it('should do something', async () => {
    const result = await doSomething();
    expect(result).toBeDefined();
  });
});
```

---

## 🎯 Best Practices

### 1. Always Validate Input
```typescript
const validated = CreateTripSchema.parse(params);
```

### 2. Use Standardized Errors
```typescript
throw new McpToolError(ErrorCode.NOT_FOUND, 'Trip not found');
```

### 3. Cache Expensive Queries
```typescript
return getCached(key, fetchFn, { ttl: 300 });
```

### 4. Use Structured Logging
```typescript
logger.info({ tripId }, 'Trip created');
```

### 5. Invalidate Caches
```typescript
await updateData();
await invalidateCache(key);
```

---

## 📝 Code Examples

### Complete Example

See `docs/QUICK_START_GUIDE.md` for a complete example showing:
- Input validation with Zod
- Error handling with McpToolError
- Caching with Redis
- Structured logging
- JSON field validation
- Database retry logic

### Migration Examples

See `IMPLEMENTATION_SUMMARY.md` for before/after examples of:
- Updating error handling
- Adding validation
- Implementing caching
- Adding logging
- Validating JSON fields

---

## 🔧 Utilities Reference

### Error Handling
```typescript
import {
  McpToolError,
  ErrorCode,
  handleQueryError,
  notFoundError,
  validationError,
  duplicateError,
  constraintError
} from '@/lib/shared/errors';
```

### Validation
```typescript
import {
  UuidSchema,
  DateSchema,
  MoneySchema,
  NameSchema,
  EmailSchema,
  // ... 25+ more schemas
} from '@/lib/shared/validation/common';

import {
  JsonFieldHelpers,
  TravellerSchema,
  LocationSchema,
  // ... more JSON schemas
} from '@/lib/shared/validation/json';
```

### Caching
```typescript
import {
  getCached,
  getCachedSWR,
  invalidateCache,
  CacheKeys,
  CachePresets,
  CacheBatch
} from '@/lib/shared/cache';
```

### Logging
```typescript
import {
  logger,
  createLogger,
  createToolLogger,
  logQuery,
  logCache,
  logTool,
  logPerformance,
  logEvent,
  logTimed
} from '@/lib/shared/logger';
```

### Configuration
```typescript
import {
  config,
  isFeatureEnabled,
  isCachingEnabled,
  getCacheTtl,
  isDevelopment,
  isProduction
} from '@/lib/shared/config';
```

### Database
```typescript
import {
  prisma,
  withRetry,
  withRetryTransaction,
  checkDatabaseHealth,
  BatchOperations,
  QueryHelpers,
  DatabaseMetrics
} from '@/lib/shared/db';
```

---

## 📊 Metrics & Monitoring

### Performance Metrics

- Query response times (logged automatically)
- Cache hit rates (via `logCache()`)
- Slow queries (threshold: 1000ms)
- Tool execution times (via `createToolLogger()`)

### Error Tracking

- Error codes and frequencies
- Error context and stack traces
- Validation error patterns

### Cache Metrics

- Hit/miss rates
- TTL effectiveness
- Invalidation frequency

---

## 🚀 Next Steps

### Phase 2: Code Organization (Recommended)

1. Split large query files by feature
2. Split MCP tool registration files
3. Create comprehensive API documentation

### Phase 3: Advanced Features

1. Rate limiting with Upstash
2. Audit logging system
3. Security enhancements
4. Performance optimization

See `IMPLEMENTATION_SUMMARY.md` for the complete roadmap.

---

## 📞 Getting Help

1. Check the **Quick Start Guide** for common use cases
2. Review **Implementation Summary** for detailed explanations
3. Look at **test files** for working examples
4. Check **type definitions** in source files

---

## 🔗 Quick Links

- [Best Practices Overview](../README_BEST_PRACTICES.md)
- [Quick Start Guide](QUICK_START_GUIDE.md)
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md)
- [Code Review](../mcp-tools-code-review.md)
- [Environment Variables](../.env.example)

---

**Last Updated**: January 18, 2026
**Version**: 1.0.0
