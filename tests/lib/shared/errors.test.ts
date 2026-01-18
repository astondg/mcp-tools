/**
 * Error Handling Tests
 */

import { describe, it, expect } from 'vitest';
import {
  McpToolError,
  ErrorCode,
  handleQueryError,
  notFoundError,
  validationError,
  duplicateError,
  constraintError,
} from '@/lib/shared/errors';

describe('McpToolError', () => {
  it('should create error with correct properties', () => {
    const error = new McpToolError(
      ErrorCode.NOT_FOUND,
      'Item not found',
      { id: '123' },
      404
    );

    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe('Item not found');
    expect(error.details).toEqual({ id: '123' });
    expect(error.httpStatus).toBe(404);
    expect(error.name).toBe('McpToolError');
  });

  it('should serialize to JSON correctly', () => {
    const error = new McpToolError(
      ErrorCode.INVALID_INPUT,
      'Invalid data',
      { field: 'name' }
    );

    const json = error.toJSON();

    expect(json).toEqual({
      error: {
        code: ErrorCode.INVALID_INPUT,
        message: 'Invalid data',
        details: { field: 'name' },
      },
    });
  });

  it('should have default http status 400', () => {
    const error = new McpToolError(ErrorCode.INVALID_INPUT, 'Invalid');

    expect(error.httpStatus).toBe(400);
  });
});

describe('Error Helper Functions', () => {
  describe('notFoundError', () => {
    it('should create not found error without identifier', () => {
      const error = notFoundError('Trip');

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('Trip not found');
      expect(error.httpStatus).toBe(404);
    });

    it('should create not found error with identifier', () => {
      const error = notFoundError('Trip', 'abc-123');

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe("Trip with identifier 'abc-123' not found");
      expect(error.httpStatus).toBe(404);
    });
  });

  describe('validationError', () => {
    it('should create validation error', () => {
      const error = validationError('Invalid email format', { field: 'email' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid email format');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.httpStatus).toBe(400);
    });
  });

  describe('duplicateError', () => {
    it('should create duplicate error', () => {
      const error = duplicateError('User', 'email');

      expect(error.code).toBe(ErrorCode.DUPLICATE);
      expect(error.message).toBe('User with this email already exists');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.httpStatus).toBe(409);
    });
  });

  describe('constraintError', () => {
    it('should create constraint error', () => {
      const error = constraintError('Foreign key violation');

      expect(error.code).toBe(ErrorCode.CONSTRAINT_VIOLATION);
      expect(error.message).toBe('Foreign key violation');
      expect(error.httpStatus).toBe(400);
    });
  });
});

describe('handleQueryError', () => {
  it('should re-throw McpToolError as-is', () => {
    const originalError = new McpToolError(ErrorCode.NOT_FOUND, 'Not found');

    expect(() => handleQueryError(originalError, 'test')).toThrow(originalError);
  });

  it('should handle Prisma P2002 (duplicate) error', () => {
    const prismaError = {
      code: 'P2002',
      meta: { target: ['email'] },
      message: 'Unique constraint failed',
      clientVersion: '5.0.0',
    };

    expect(() => handleQueryError(prismaError, 'createUser')).toThrow(McpToolError);

    try {
      handleQueryError(prismaError, 'createUser');
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.DUPLICATE);
      expect(error.message).toContain('Duplicate');
    }
  });

  it('should handle Prisma P2025 (not found) error', () => {
    const prismaError = {
      code: 'P2025',
      meta: {},
      message: 'Record not found',
      clientVersion: '5.0.0',
    };

    expect(() => handleQueryError(prismaError, 'getUser')).toThrow(McpToolError);

    try {
      handleQueryError(prismaError, 'getUser');
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('should handle generic errors', () => {
    const genericError = new Error('Something went wrong');

    expect(() => handleQueryError(genericError, 'operation')).toThrow(McpToolError);

    try {
      handleQueryError(genericError, 'operation');
    } catch (error: any) {
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toContain('operation');
      expect(error.httpStatus).toBe(500);
    }
  });
});
