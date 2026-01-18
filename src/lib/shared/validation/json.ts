/**
 * JSON Field Validation Schemas
 *
 * Type-safe schemas for validating JSON fields stored as strings in the database
 * Provides parsing, validation, and stringification utilities
 */

import { z } from 'zod';
import { NameSchema, AgeSchema, ShortDescriptionSchema } from './common';

/**
 * Traveller schema for trip planning
 */
export const TravellerSchema = z.object({
  name: NameSchema,
  age: AgeSchema.optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be YYYY-MM-DD').optional(),
  notes: ShortDescriptionSchema,
});

export type Traveller = z.infer<typeof TravellerSchema>;

/**
 * Array of travellers
 */
export const TravellersArraySchema = z.array(TravellerSchema)
  .min(1, 'At least one traveller is required')
  .max(20, 'Cannot have more than 20 travellers');

/**
 * Location/coordinates schema
 */
export const LocationSchema = z.object({
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().optional(), // Google Places ID
  name: NameSchema.optional(),
});

export type Location = z.infer<typeof LocationSchema>;

/**
 * Contact information schema
 */
export const ContactSchema = z.object({
  name: NameSchema.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  notes: ShortDescriptionSchema,
});

export type Contact = z.infer<typeof ContactSchema>;

/**
 * Booking confirmation schema
 */
export const BookingConfirmationSchema = z.object({
  confirmationNumber: z.string().max(100).optional(),
  bookingReference: z.string().max(100).optional(),
  provider: NameSchema.optional(),
  bookedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  url: z.string().url().optional(),
});

export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;

/**
 * Tags schema (array of strings)
 */
export const TagsSchema = z.array(
  z.string().min(1).max(50).transform((val) => val.replace(/<[^>]*>/g, '').trim())
).max(50, 'Cannot have more than 50 tags');

export type Tags = z.infer<typeof TagsSchema>;

/**
 * Pros/Cons schema (array of strings)
 */
export const ProsConsSchema = z.array(
  z.string().min(1).max(200)
).max(20, 'Cannot have more than 20 items');

export type ProsCons = z.infer<typeof ProsConsSchema>;

/**
 * Opening hours schema
 */
export const OpeningHoursSchema = z.object({
  monday: z.string().optional(),
  tuesday: z.string().optional(),
  wednesday: z.string().optional(),
  thursday: z.string().optional(),
  friday: z.string().optional(),
  saturday: z.string().optional(),
  sunday: z.string().optional(),
  notes: z.string().max(200).optional(),
});

export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

/**
 * Key-value metadata schema (flexible additional data)
 */
export const MetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
).optional();

export type Metadata = z.infer<typeof MetadataSchema>;

/**
 * File attachment schema
 */
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  url: z.string().url(),
  type: z.string(), // MIME type
  size: z.number().int().positive(),
  uploadedAt: z.string().datetime(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

export const AttachmentsArraySchema = z.array(AttachmentSchema).max(20);

/**
 * Generic parse function for JSON fields with validation
 * @param value - The JSON string from database
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated object, or null if invalid
 */
export function parseJsonField<T>(
  value: string | null | undefined,
  schema: z.ZodSchema<T>
): T | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return schema.parse(parsed);
  } catch (error) {
    console.error('JSON parse error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      value: value?.substring(0, 100), // Log first 100 chars for debugging
    });
    return null;
  }
}

/**
 * Generic stringify function for JSON fields with validation
 * @param value - The object to stringify
 * @param schema - Zod schema to validate against
 * @returns JSON string or null if invalid
 */
export function stringifyJsonField<T>(
  value: T | null | undefined,
  schema: z.ZodSchema<T>
): string | null {
  if (!value) return null;

  try {
    const validated = schema.parse(value);
    return JSON.stringify(validated);
  } catch (error) {
    console.error('JSON stringify error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      value,
    });
    return null;
  }
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParseJsonField<T>(
  value: string | null | undefined,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  if (!value) {
    return { success: false, error: 'No value provided' };
  }

  try {
    const parsed = JSON.parse(value);
    const result = schema.safeParse(parsed);

    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON parse error',
    };
  }
}

/**
 * Helper to update a single field in a JSON array
 */
export function updateJsonArrayItem<T>(
  jsonString: string | null,
  schema: z.ZodSchema<T[]>,
  index: number,
  updater: (item: T) => T
): string | null {
  const array = parseJsonField(jsonString, schema);
  if (!array || index < 0 || index >= array.length) {
    return jsonString;
  }

  array[index] = updater(array[index]);
  return stringifyJsonField(array, schema);
}

/**
 * Helper to add item to JSON array
 */
export function addToJsonArray<T>(
  jsonString: string | null,
  schema: z.ZodSchema<T[]>,
  item: T
): string {
  const array = parseJsonField(jsonString, schema) || [];
  array.push(item);
  return stringifyJsonField(array, schema) || '[]';
}

/**
 * Helper to remove item from JSON array
 */
export function removeFromJsonArray<T>(
  jsonString: string | null,
  schema: z.ZodSchema<T[]>,
  predicate: (item: T) => boolean
): string {
  const array = parseJsonField(jsonString, schema) || [];
  const filtered = array.filter(item => !predicate(item));
  return stringifyJsonField(filtered, schema) || '[]';
}

/**
 * Merge two JSON objects (for metadata)
 */
export function mergeJsonObjects(
  existing: string | null,
  updates: Record<string, any>
): string {
  const existingData = parseJsonField(existing, MetadataSchema) || {};
  const merged = { ...existingData, ...updates };
  return stringifyJsonField(merged, MetadataSchema) || '{}';
}

/**
 * Type-safe helpers for common JSON field types
 */
export const JsonFieldHelpers = {
  /**
   * Parse travellers array
   */
  parseTravellers: (value: string | null) =>
    parseJsonField(value, TravellersArraySchema),

  /**
   * Stringify travellers array
   */
  stringifyTravellers: (value: Traveller[] | null) =>
    stringifyJsonField(value, TravellersArraySchema),

  /**
   * Parse tags array
   */
  parseTags: (value: string | null) =>
    parseJsonField(value, TagsSchema),

  /**
   * Stringify tags array
   */
  stringifyTags: (value: string[] | null) =>
    stringifyJsonField(value, TagsSchema),

  /**
   * Parse location object
   */
  parseLocation: (value: string | null) =>
    parseJsonField(value, LocationSchema),

  /**
   * Stringify location object
   */
  stringifyLocation: (value: Location | null) =>
    stringifyJsonField(value, LocationSchema),

  /**
   * Parse contact object
   */
  parseContact: (value: string | null) =>
    parseJsonField(value, ContactSchema),

  /**
   * Stringify contact object
   */
  stringifyContact: (value: Contact | null) =>
    stringifyJsonField(value, ContactSchema),

  /**
   * Parse booking confirmation
   */
  parseBooking: (value: string | null) =>
    parseJsonField(value, BookingConfirmationSchema),

  /**
   * Stringify booking confirmation
   */
  stringifyBooking: (value: BookingConfirmation | null) =>
    stringifyJsonField(value, BookingConfirmationSchema),

  /**
   * Parse pros/cons array
   */
  parseProsConsArray: (value: string | null) =>
    parseJsonField(value, ProsConsSchema),

  /**
   * Stringify pros/cons array
   */
  stringifyProsConsArray: (value: string[] | null) =>
    stringifyJsonField(value, ProsConsSchema),

  /**
   * Parse metadata object
   */
  parseMetadata: (value: string | null) =>
    parseJsonField(value, MetadataSchema),

  /**
   * Stringify metadata object
   */
  stringifyMetadata: (value: Record<string, any> | null) =>
    stringifyJsonField(value, MetadataSchema),
};
