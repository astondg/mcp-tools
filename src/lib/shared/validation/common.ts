/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for consistent validation across all MCP tools
 * Provides type-safe validation patterns for common data types
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
export const UuidSchema = z.string().uuid({
  message: 'Invalid ID format. Must be a valid UUID',
});

/**
 * Date string validation (YYYY-MM-DD format)
 */
export const DateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
).refine(
  (dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  },
  { message: 'Invalid date value' }
);

/**
 * DateTime string validation (ISO 8601)
 */
export const DateTimeSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 datetime string',
});

/**
 * Money/currency amount validation
 * Allows positive numbers up to 9,999,999.99
 */
export const MoneySchema = z.number()
  .min(0, 'Amount must be positive')
  .max(9999999.99, 'Amount exceeds maximum value')
  .finite('Amount must be a finite number');

/**
 * Optional money schema (allows null/undefined)
 */
export const OptionalMoneySchema = MoneySchema.optional().nullable();

/**
 * Name validation (1-100 characters, trimmed)
 */
export const NameSchema = z.string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name cannot exceed 100 characters')
  .trim();

/**
 * Short name validation (1-50 characters)
 */
export const ShortNameSchema = z.string()
  .min(1, 'Name cannot be empty')
  .max(50, 'Name cannot exceed 50 characters')
  .trim();

/**
 * Long name validation (1-200 characters)
 */
export const LongNameSchema = z.string()
  .min(1, 'Name cannot be empty')
  .max(200, 'Name cannot exceed 200 characters')
  .trim();

/**
 * Notes/description validation (optional, max 5000 characters)
 */
export const NotesSchema = z.string()
  .max(5000, 'Notes cannot exceed 5000 characters')
  .optional()
  .nullable();

/**
 * Short description validation (max 500 characters)
 */
export const ShortDescriptionSchema = z.string()
  .max(500, 'Description cannot exceed 500 characters')
  .optional()
  .nullable();

/**
 * Email validation
 */
export const EmailSchema = z.string()
  .email('Invalid email format')
  .toLowerCase()
  .trim();

/**
 * Phone number validation (flexible international format)
 */
export const PhoneSchema = z.string()
  .regex(
    /^\+?[\d\s\-()]+$/,
    'Invalid phone number format. Use digits, spaces, hyphens, parentheses, and optional + prefix'
  )
  .optional()
  .nullable();

/**
 * URL validation
 */
export const UrlSchema = z.string()
  .url('Invalid URL format')
  .optional()
  .nullable();

/**
 * Currency code validation (ISO 4217)
 */
export const CurrencySchema = z.string()
  .length(3, 'Currency code must be exactly 3 characters')
  .toUpperCase()
  .refine(
    (code) => /^[A-Z]{3}$/.test(code),
    { message: 'Currency code must contain only uppercase letters' }
  )
  .default('AUD');

/**
 * Positive integer validation
 */
export const PositiveIntSchema = z.number()
  .int('Must be an integer')
  .positive('Must be a positive number');

/**
 * Non-negative integer validation (allows 0)
 */
export const NonNegativeIntSchema = z.number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

/**
 * Percentage validation (0-100)
 */
export const PercentageSchema = z.number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage cannot exceed 100');

/**
 * Pagination limit validation
 */
export const PaginationLimitSchema = z.number()
  .int('Limit must be an integer')
  .min(1, 'Limit must be at least 1')
  .max(1000, 'Limit cannot exceed 1000')
  .default(100);

/**
 * Pagination offset validation
 */
export const PaginationOffsetSchema = z.number()
  .int('Offset must be an integer')
  .min(0, 'Offset must be non-negative')
  .default(0);

/**
 * Date range validation schema
 * Ensures end date is after start date
 */
export const DateRangeSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
);

/**
 * Optional date range schema
 */
export const OptionalDateRangeSchema = z.object({
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
  },
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
);

/**
 * Tags array validation (string array)
 */
export const TagsSchema = z.array(z.string().trim().min(1))
  .max(50, 'Cannot have more than 50 tags')
  .optional()
  .nullable();

/**
 * Color hex code validation
 */
export const ColorHexSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color code (e.g., #FF5733)')
  .optional();

/**
 * Latitude validation
 */
export const LatitudeSchema = z.number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

/**
 * Longitude validation
 */
export const LongitudeSchema = z.number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/**
 * Coordinates validation (lat/lng pair)
 */
export const CoordinatesSchema = z.object({
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
});

/**
 * Priority level validation
 */
export const PrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
  errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL' }),
});

/**
 * Boolean with string coercion (for form data)
 */
export const BooleanSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return val === 'true' || val === '1';
    }
    return val;
  },
  z.boolean()
);

/**
 * Safe string that strips HTML/scripts
 */
export const SafeStringSchema = z.string().transform((val) => {
  // Remove HTML tags and script content
  return val.replace(/<[^>]*>/g, '').trim();
});

/**
 * Age validation (0-120 years)
 */
export const AgeSchema = z.number()
  .int('Age must be a whole number')
  .min(0, 'Age must be non-negative')
  .max(120, 'Age cannot exceed 120 years');

/**
 * Rating validation (1-5 stars)
 */
export const RatingSchema = z.number()
  .int('Rating must be a whole number')
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating cannot exceed 5');

/**
 * Search query validation
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query cannot be empty')
  .max(200, 'Search query cannot exceed 200 characters')
  .trim();

/**
 * Sort order validation
 */
export const SortOrderSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Sort order must be "asc" or "desc"' }),
}).default('asc');

/**
 * File size validation (in bytes)
 */
export const FileSizeSchema = z.number()
  .int('File size must be an integer')
  .min(0, 'File size must be non-negative')
  .max(100 * 1024 * 1024, 'File size cannot exceed 100MB'); // 100MB max

/**
 * MIME type validation
 */
export const MimeTypeSchema = z.string()
  .regex(
    /^[a-z]+\/[a-z0-9\-\+\.]+$/i,
    'Invalid MIME type format'
  );

/**
 * Helper to create enum schema with better error messages
 */
export function createEnumSchema<T extends readonly [string, ...string[]]>(
  values: T,
  entityName: string
) {
  return z.enum(values, {
    errorMap: () => ({
      message: `${entityName} must be one of: ${values.join(', ')}`,
    }),
  });
}

/**
 * Helper to create optional UUID reference
 */
export const OptionalUuidSchema = UuidSchema.optional().nullable();

/**
 * Helper for creating string arrays with validation
 */
export function createStringArraySchema(
  minItems: number = 0,
  maxItems: number = 100,
  itemMinLength: number = 1,
  itemMaxLength: number = 200
) {
  return z.array(
    z.string()
      .min(itemMinLength, `Each item must be at least ${itemMinLength} characters`)
      .max(itemMaxLength, `Each item cannot exceed ${itemMaxLength} characters`)
      .trim()
  )
    .min(minItems, `Must have at least ${minItems} items`)
    .max(maxItems, `Cannot have more than ${maxItems} items`);
}
