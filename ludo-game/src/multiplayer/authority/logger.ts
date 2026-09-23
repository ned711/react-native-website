/**
 * Structured logging port. Implementations must never receive secrets: the
 * authority only logs identifiers, codes and counters.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface Logger {
  log(level: LogLevel, message: string, fields?: LogFields): void;
}

export const silentLogger: Logger = {log() {}};

export class MemoryLogger implements Logger {
  readonly entries: {level: LogLevel; message: string; fields: LogFields}[] =
    [];
  log(level: LogLevel, message: string, fields: LogFields = {}): void {
    this.entries.push({level, message, fields});
  }
}

export const consoleJsonLogger: Logger = {
  log(level, message, fields = {}) {
    const line = JSON.stringify({
      level,
      message,
      ...fields,
      ts: new Date().toISOString(),
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  },
};
