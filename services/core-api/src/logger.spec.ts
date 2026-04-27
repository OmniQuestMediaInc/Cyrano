// WO: RRR-TEST-HELPER — real tests for services/core-api/src/logger.ts
// Uses centralized env helper to avoid the recurring NODE_ENV merge-conflict pattern.

import { logger, type LogEntry } from './logger';
import { setLogLevel, setTestEnv } from './test/helpers/setTestEnv';

type WriteCall = { stream: 'stdout' | 'stderr'; entry: LogEntry };

function captureWrites(): { calls: WriteCall[]; restore: () => void } {
  const calls: WriteCall[] = [];
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    calls.push({ stream: 'stdout', entry: JSON.parse(String(chunk)) });
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    calls.push({ stream: 'stderr', entry: JSON.parse(String(chunk)) });
    return true;
  }) as typeof process.stderr.write;

  return {
    calls,
    restore: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    },
  };
}

describe('logger', () => {
  let restoreEnv: () => void;
  let restoreLogLevel: () => void;
  let capture: ReturnType<typeof captureWrites>;

  beforeEach(() => {
    restoreEnv = setTestEnv('test');
    restoreLogLevel = setLogLevel(undefined);
    capture = captureWrites();
  });

  afterEach(() => {
    capture.restore();
    restoreLogLevel();
    restoreEnv();
  });

  it('writes info entries to stdout with level=info', () => {
    logger.info('hello', { requestId: 'r1' });
    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0].stream).toBe('stdout');
    expect(capture.calls[0].entry).toMatchObject({
      level: 'info',
      message: 'hello',
      requestId: 'r1',
    });
  });

  it('writes warn entries to stdout with level=warn', () => {
    logger.warn('careful');
    expect(capture.calls[0].stream).toBe('stdout');
    expect(capture.calls[0].entry.level).toBe('warn');
    expect(capture.calls[0].entry.message).toBe('careful');
  });

  it('writes error entries to stderr and formats Error objects', () => {
    logger.error('boom', new Error('disk full'), { code: 'EIO' });
    expect(capture.calls[0].stream).toBe('stderr');
    expect(capture.calls[0].entry).toMatchObject({
      level: 'error',
      message: 'boom',
      code: 'EIO',
      error: 'Error: disk full',
    });
  });

  it('omits the error field when no error is supplied', () => {
    logger.error('boom');
    expect(capture.calls[0].entry).not.toHaveProperty('error');
  });

  it('suppresses debug output when LOG_LEVEL is unset', () => {
    logger.debug('skipme');
    expect(capture.calls).toHaveLength(0);
  });

  it('emits debug output when LOG_LEVEL=debug', () => {
    restoreLogLevel();
    restoreLogLevel = setLogLevel('debug');
    logger.debug('verbose', { trace: 'abc' });
    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0].stream).toBe('stdout');
    expect(capture.calls[0].entry).toMatchObject({
      level: 'debug',
      message: 'verbose',
      trace: 'abc',
    });
  });

  it('restores NODE_ENV after the helper teardown runs', () => {
    const probe = setTestEnv('production');
    expect(process.env.NODE_ENV).toBe('production');
    probe();
    expect(process.env.NODE_ENV).toBe('test');
  });
});

// ## HANDOFF
// Jest alignment: this spec lives at services/core-api/src/logger.spec.ts and is
// picked up by the testMatch pattern <rootDir>/services/**/src/**/*.spec.ts in
// jest.config.js. tsconfig.json already excludes **/*.spec.ts from the build.
// Future loggers/services should colocate *.spec.ts beside their source and
// import env mutators from services/core-api/src/test/helpers/setTestEnv.ts
// (or a sibling helpers/ dir within their own service) — never mutate
// process.env.NODE_ENV directly inside a spec.
