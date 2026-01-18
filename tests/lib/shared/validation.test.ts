/**
 * Validation Tests
 */

import { describe, it, expect } from 'vitest';
import {
  UuidSchema,
  DateSchema,
  MoneySchema,
  NameSchema,
  EmailSchema,
  CurrencySchema,
  DateRangeSchema,
} from '@/lib/shared/validation/common';

describe('Common Validation Schemas', () => {
  describe('UuidSchema', () => {
    it('should validate valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = UuidSchema.safeParse(uuid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = UuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('DateSchema', () => {
    it('should validate valid date', () => {
      const result = DateSchema.safeParse('2026-01-18');
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = DateSchema.safeParse('18/01/2026');
      expect(result.success).toBe(false);
    });

    it('should reject invalid date value', () => {
      const result = DateSchema.safeParse('2026-13-45');
      expect(result.success).toBe(false);
    });
  });

  describe('MoneySchema', () => {
    it('should validate positive number', () => {
      const result = MoneySchema.safeParse(100.50);
      expect(result.success).toBe(true);
    });

    it('should validate zero', () => {
      const result = MoneySchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it('should reject negative number', () => {
      const result = MoneySchema.safeParse(-100);
      expect(result.success).toBe(false);
    });

    it('should reject number exceeding max', () => {
      const result = MoneySchema.safeParse(10000000);
      expect(result.success).toBe(false);
    });
  });

  describe('NameSchema', () => {
    it('should validate valid name', () => {
      const result = NameSchema.safeParse('John Doe');
      expect(result.success).toBe(true);
      expect(result.data).toBe('John Doe');
    });

    it('should trim whitespace', () => {
      const result = NameSchema.safeParse('  Jane  ');
      expect(result.success).toBe(true);
      expect(result.data).toBe('Jane');
    });

    it('should reject empty string', () => {
      const result = NameSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject string exceeding max length', () => {
      const longName = 'a'.repeat(101);
      const result = NameSchema.safeParse(longName);
      expect(result.success).toBe(false);
    });
  });

  describe('EmailSchema', () => {
    it('should validate valid email', () => {
      const result = EmailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should lowercase email', () => {
      const result = EmailSchema.safeParse('Test@Example.COM');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      const result = EmailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });
  });

  describe('CurrencySchema', () => {
    it('should validate 3-letter currency code', () => {
      const result = CurrencySchema.safeParse('USD');
      expect(result.success).toBe(true);
    });

    it('should uppercase currency code', () => {
      const result = CurrencySchema.safeParse('aud');
      expect(result.success).toBe(true);
      expect(result.data).toBe('AUD');
    });

    it('should use default value', () => {
      const result = CurrencySchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBe('AUD');
    });

    it('should reject invalid length', () => {
      const result = CurrencySchema.safeParse('US');
      expect(result.success).toBe(false);
    });
  });

  describe('DateRangeSchema', () => {
    it('should validate valid date range', () => {
      const result = DateRangeSchema.safeParse({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should accept same start and end date', () => {
      const result = DateRangeSchema.safeParse({
        startDate: '2026-01-01',
        endDate: '2026-01-01',
      });
      expect(result.success).toBe(true);
    });

    it('should reject end date before start date', () => {
      const result = DateRangeSchema.safeParse({
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });
  });
});
