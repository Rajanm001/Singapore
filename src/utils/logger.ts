/**
 * Structured logger for the Knowledge & Workflow Engine
 * Provides consistent logging with levels, context, and structured data
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'text' | 'json';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  child(context: string): Logger;
}

export interface LoggerConfig {
  context?: string;
  minLevel?: LogLevel;
  format?: LogFormat;
  correlationId?: string;
}

/**
 * Get log level from environment with fallback
 */
function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel === 'debug' || envLevel === 'info' || envLevel === 'warn' || envLevel === 'error') {
    return envLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Get log format from environment with fallback
 */
function getLogFormatFromEnv(): LogFormat {
  const envFormat = process.env.LOG_FORMAT?.toLowerCase();
  if (envFormat === 'json') {
    return 'json';
  }
  return process.env.NODE_ENV === 'production' ? 'json' : 'text';
}

/**
 * Console-based logger implementation
 */
export class ConsoleLogger implements Logger {
  private minLevel: LogLevel;
  private logFormat: LogFormat;
  private correlationId?: string;

  constructor(
    private context?: string,
    config?: Partial<LoggerConfig>
  ) {
    this.minLevel = config?.minLevel ?? getLogLevelFromEnv();
    this.logFormat = config?.format ?? getLogFormatFromEnv();
    this.correlationId = config?.correlationId;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('error', message, data, error);
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new ConsoleLogger(childContext, {
      minLevel: this.minLevel,
      format: this.logFormat,
      correlationId: this.correlationId,
    });
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      data,
      error,
    };

    const formattedMessage = this.format(entry);

    // eslint-disable-next-line no-console
    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(formattedMessage);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(formattedMessage);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(formattedMessage);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(formattedMessage);
        if (error) {
          // eslint-disable-next-line no-console
          console.error(error.stack);
        }
        break;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minLevelIndex = levels.indexOf(this.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  private format(entry: LogEntry): string {
    if (this.logFormat === 'json') {
      return this.formatJson(entry);
    }
    return this.formatText(entry);
  }

  private formatText(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? `[${entry.context}]` : '';
    const correlationId = this.correlationId ? `[${this.correlationId}]` : '';
    const message = entry.message;
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

    return `${timestamp} ${level} ${context}${correlationId} ${message}${data}`;
  }

  private formatJson(entry: LogEntry): string {
    const logObject: Record<string, unknown> = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
    };

    if (entry.context) {
      logObject.context = entry.context;
    }

    if (this.correlationId) {
      logObject.correlationId = this.correlationId;
    }

    if (entry.data) {
      logObject.data = entry.data;
    }

    if (entry.error) {
      logObject.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    return JSON.stringify(logObject);
  }
}

/**
 * Create a default logger instance
 */
export function createLogger(context?: string, config?: Partial<LoggerConfig>): Logger {
  return new ConsoleLogger(context, config);
}

/**
 * Global logger instance
 */
export const logger = createLogger('WorkflowEngine');
