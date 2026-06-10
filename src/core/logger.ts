/* Logger leve com níveis, timestamp e cores ANSI — sem dependências externas. */

const c = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
} as const;

function stamp(): string {
  return new Date().toISOString();
}

function write(color: string, level: string, args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(`${c.gray}${stamp()}${c.reset} ${color}[${level}]${c.reset}`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => write(c.gray, 'DEBUG', args),
  info: (...args: unknown[]) => write(c.blue, 'INFO', args),
  success: (...args: unknown[]) => write(c.green, 'OK', args),
  warn: (...args: unknown[]) => write(c.yellow, 'WARN', args),
  error: (...args: unknown[]) => write(c.red, 'ERROR', args)
};
