// WO: WO-INIT-001

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  error?: unknown;
  [key: string]: unknown;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function write(entry: LogEntry, stream: NodeJS.WritableStream): void {
  stream.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = { level: 'info', message, ...(meta || {}) };
    write(entry, process.stdout);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = { level: 'warn', message, ...(meta || {}) };
    write(entry, process.stdout);
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      ...(meta || {}),
      ...(error !== undefined ? { error: formatError(error) } : {}),
    };
    write(entry, process.stderr);
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      const entry: LogEntry = { level: 'debug', message, ...(meta || {}) };
      write(entry, process.stdout);
    }
  },
};
