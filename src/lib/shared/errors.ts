/**
 * Standardized Error Handling System
 *
 * Provides consistent error handling across all MCP tools with:
 * - Type-safe error codes
 * - Structured error responses
 * - HTTP status code mapping
 * - Contextual error details
 */

export enum ErrorCode {
  // Client Errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  DUPLICATE = 'DUPLICATE',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONFLICT = 'CONFLICT',

  // Server Errors (5xx)
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

/**
 * Custom error class for MCP tools
 * Provides consistent error structure with codes, messages, and optional details
 */
export class McpToolError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details?: unknown,
    public httpStatus: number = 400
  ) {
    super(message);
    this.name = 'McpToolError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpToolError);
    }
  }

  /**
   * Returns JSON-serializable error object
   */
  toJSON() {
    const error: { code: ErrorCode; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    };
    if (this.details) {
      error.details = this.details;
    }
    return { error };
  }

  /**
   * Returns user-friendly error message
   */
  toString() {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Error response type for consistent API responses
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Map Prisma error codes to our custom error codes
 */
const PRISMA_ERROR_MAP: Record<string, { code: ErrorCode; status: number }> = {
  P2002: { code: ErrorCode.DUPLICATE, status: 409 },        // Unique constraint failed
  P2003: { code: ErrorCode.CONSTRAINT_VIOLATION, status: 400 }, // Foreign key constraint failed
  P2025: { code: ErrorCode.NOT_FOUND, status: 404 },        // Record not found
  P2014: { code: ErrorCode.CONSTRAINT_VIOLATION, status: 400 }, // Required relation violation
  P2011: { code: ErrorCode.CONSTRAINT_VIOLATION, status: 400 }, // Null constraint violation
  P1001: { code: ErrorCode.DATABASE_ERROR, status: 503 },   // Can't reach database
  P1002: { code: ErrorCode.DATABASE_ERROR, status: 503 },   // Database timeout
};

/**
 * Handles errors from query functions consistently
 * Converts Prisma errors to McpToolError instances
 *
 * @param error - The caught error
 * @param context - Context string for logging/debugging
 * @throws {McpToolError} - Standardized error
 */
export function handleQueryError(error: unknown, context: string): never {
  // Re-throw if already a McpToolError
  if (error instanceof McpToolError) {
    throw error;
  }

  // Handle Prisma errors
  if (isPrismaError(error)) {
    const errorMapping = PRISMA_ERROR_MAP[error.code];

    if (errorMapping) {
      throw new McpToolError(
        errorMapping.code,
        `${context}: ${getPrismaErrorMessage(error)}`,
        {
          prismaCode: error.code,
          meta: error.meta,
          clientVersion: error.clientVersion,
        },
        errorMapping.status
      );
    }

    // Unknown Prisma error
    throw new McpToolError(
      ErrorCode.DATABASE_ERROR,
      `Database error in ${context}`,
      {
        prismaCode: error.code,
        message: error.message,
      },
      500
    );
  }

  // Handle Zod validation errors
  if (isZodError(error)) {
    throw new McpToolError(
      ErrorCode.VALIDATION_ERROR,
      `Validation failed in ${context}`,
      {
        issues: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      },
      400
    );
  }

  // Generic error
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  throw new McpToolError(
    ErrorCode.INTERNAL_ERROR,
    `Error in ${context}: ${errorMessage}`,
    error,
    500
  );
}

/**
 * Type guard for Prisma errors
 */
function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'meta' in error &&
    'clientVersion' in error
  );
}

/**
 * Type guard for Zod errors
 */
function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as any).issues)
  );
}

/**
 * Get human-readable message from Prisma error
 */
function getPrismaErrorMessage(error: PrismaError): string {
  switch (error.code) {
    case 'P2002':
      const target = error.meta?.target as string[] | undefined;
      return `Duplicate value for ${target ? target.join(', ') : 'unique field'}`;
    case 'P2003':
      return 'Related record not found';
    case 'P2025':
      return 'Record not found';
    case 'P2014':
      return 'Required relationship missing';
    case 'P2011':
      return 'Required field cannot be null';
    case 'P1001':
      return 'Cannot reach database server';
    case 'P1002':
      return 'Database operation timed out';
    default:
      return error.message;
  }
}

// Type definitions for Prisma and Zod errors
interface PrismaError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
  clientVersion: string;
}

interface ZodError {
  issues: Array<{
    code: string;
    message: string;
    path: (string | number)[];
  }>;
  errors: Array<{
    code: string;
    message: string;
    path: (string | number)[];
  }>;
}

/**
 * Create a not found error
 */
export function notFoundError(entity: string, identifier?: string): McpToolError {
  const message = identifier
    ? `${entity} with identifier '${identifier}' not found`
    : `${entity} not found`;

  return new McpToolError(ErrorCode.NOT_FOUND, message, undefined, 404);
}

/**
 * Create a validation error
 */
export function validationError(message: string, details?: unknown): McpToolError {
  return new McpToolError(ErrorCode.VALIDATION_ERROR, message, details, 400);
}

/**
 * Create a duplicate error
 */
export function duplicateError(entity: string, field: string): McpToolError {
  return new McpToolError(
    ErrorCode.DUPLICATE,
    `${entity} with this ${field} already exists`,
    { field },
    409
  );
}

/**
 * Create a constraint violation error
 */
export function constraintError(message: string, details?: unknown): McpToolError {
  return new McpToolError(ErrorCode.CONSTRAINT_VIOLATION, message, details, 400);
}

/**
 * Wraps an async function with error handling
 * Useful for consistent error handling across tool implementations
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleQueryError(error, context);
    }
  };
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
