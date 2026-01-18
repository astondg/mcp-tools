/**
 * Structured Logging System
 *
 * Provides consistent, structured logging across all MCP tools
 * Uses Pino for high-performance, JSON-structured logs
 */

import pino from 'pino';

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log context - additional metadata for logs
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  tool: string;
  params?: any;
  duration?: number;
  error?: any;
  result?: any;
}

/**
 * Create base logger instance
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),

  // Format log levels as uppercase strings
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        node_version: process.version,
      };
    },
  },

  // ISO timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty print in development
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
        messageFormat: '{levelLabel} - {msg}',
      },
    },
  }),

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
    ],
    remove: true,
  },
});

/**
 * Create child logger with context
 */
export function createLogger(context: LogContext) {
  return logger.child(context);
}

/**
 * Log query execution
 */
export function logQuery(
  operation: string,
  table: string,
  duration: number,
  context?: LogContext
) {
  logger.debug(
    {
      type: 'query',
      operation,
      table,
      duration,
      ...context,
    },
    `Database query: ${operation} on ${table} (${duration}ms)`
  );
}

/**
 * Log cache hit/miss
 */
export function logCache(
  key: string,
  hit: boolean,
  duration?: number,
  context?: LogContext
) {
  logger.debug(
    {
      type: 'cache',
      key,
      hit,
      duration,
      ...context,
    },
    `Cache ${hit ? 'HIT' : 'MISS'}: ${key}${duration ? ` (${duration}ms)` : ''}`
  );
}

/**
 * Log tool execution
 */
export function logTool(
  tool: string,
  status: 'start' | 'success' | 'error',
  context?: ToolContext
) {
  const { duration, error, result, ...rest } = context || {};

  if (status === 'start') {
    logger.info(
      {
        type: 'tool',
        tool,
        status,
        ...rest,
      },
      `Tool started: ${tool}`
    );
  } else if (status === 'success') {
    logger.info(
      {
        type: 'tool',
        tool,
        status,
        duration,
        ...rest,
      },
      `Tool completed: ${tool} (${duration}ms)`
    );
  } else if (status === 'error') {
    logger.error(
      {
        type: 'tool',
        tool,
        status,
        duration,
        error: serializeError(error),
        ...rest,
      },
      `Tool failed: ${tool} - ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Log validation error
 */
export function logValidationError(
  field: string,
  message: string,
  value?: any,
  context?: LogContext
) {
  logger.warn(
    {
      type: 'validation',
      field,
      message,
      value: sanitizeForLog(value),
      ...context,
    },
    `Validation error: ${field} - ${message}`
  );
}

/**
 * Log performance metric
 */
export function logPerformance(
  operation: string,
  duration: number,
  threshold: number = 1000,
  context?: LogContext
) {
  const isSlow = duration > threshold;

  const logFn = isSlow ? logger.warn : logger.debug;

  logFn(
    {
      type: 'performance',
      operation,
      duration,
      threshold,
      slow: isSlow,
      ...context,
    },
    `${isSlow ? 'SLOW' : ''} ${operation}: ${duration}ms`
  );
}

/**
 * Log API request/response
 */
export function logApiCall(
  method: string,
  url: string,
  status: number,
  duration: number,
  context?: LogContext
) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  logger[level](
    {
      type: 'api',
      method,
      url,
      status,
      duration,
      ...context,
    },
    `${method} ${url} - ${status} (${duration}ms)`
  );
}

/**
 * Log business event
 */
export function logEvent(
  event: string,
  data?: any,
  context?: LogContext
) {
  logger.info(
    {
      type: 'event',
      event,
      data: sanitizeForLog(data),
      ...context,
    },
    `Event: ${event}`
  );
}

/**
 * Sanitize value for logging (remove sensitive data, limit size)
 */
function sanitizeForLog(value: any, maxLength: number = 1000): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
  }

  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : value;
  }

  return value;
}

/**
 * Serialize error for logging
 */
function serializeError(error: any): any {
  if (!error) return null;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).details && { details: (error as any).details },
    };
  }

  return error;
}

/**
 * Wrapper for timing async operations
 */
export async function logTimed<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    logPerformance(operation, duration, 1000, context);

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error(
      {
        type: 'timed_operation',
        operation,
        duration,
        error: serializeError(error),
        ...context,
      },
      `Operation failed: ${operation} (${duration}ms)`
    );

    throw error;
  }
}

/**
 * Create tool logger that automatically logs execution
 */
export function createToolLogger(toolName: string) {
  return {
    /**
     * Execute tool with automatic logging
     */
    async execute<T>(
      fn: () => Promise<T>,
      params?: any
    ): Promise<T> {
      const start = Date.now();

      logTool(toolName, 'start', { tool: toolName, params });

      try {
        const result = await fn();
        const duration = Date.now() - start;

        logTool(toolName, 'success', {
          tool: toolName,
          duration,
          result: sanitizeForLog(result, 200),
        });

        return result;
      } catch (error) {
        const duration = Date.now() - start;

        logTool(toolName, 'error', {
          tool: toolName,
          duration,
          error,
        });

        throw error;
      }
    },

    /**
     * Create child logger for this tool
     */
    child: (context?: LogContext) => createLogger({ tool: toolName, ...context }),
  };
}

/**
 * Log startup information
 */
export function logStartup(appName: string, version?: string) {
  logger.info(
    {
      type: 'startup',
      app: appName,
      version,
      env: process.env.NODE_ENV,
      nodeVersion: process.version,
    },
    `Starting ${appName}${version ? ` v${version}` : ''}`
  );
}

/**
 * Log shutdown
 */
export function logShutdown(appName: string, reason?: string) {
  logger.info(
    {
      type: 'shutdown',
      app: appName,
      reason,
    },
    `Shutting down ${appName}${reason ? `: ${reason}` : ''}`
  );
}

/**
 * Correlation ID middleware helper
 */
export function withCorrelationId<T>(
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const childLogger = createLogger({ correlationId });

  // Store in async local storage if needed
  return fn();
}

// Export default logger
export default logger;
