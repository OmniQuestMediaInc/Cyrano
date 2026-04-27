// WO: RRR-TEST-HELPER — centralize NODE_ENV / LOG_LEVEL overrides for specs
// Prevents recurring merge conflicts caused by ad-hoc env mutation in test files.

export type NodeEnv = 'development' | 'production' | 'test';

type RestoreFn = () => void;

function override(name: string, value: string | undefined): RestoreFn {
  const original = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  return () => {
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  };
}

export function setTestEnv(env: NodeEnv = 'test'): RestoreFn {
  return override('NODE_ENV', env);
}

export function setLogLevel(level: string | undefined): RestoreFn {
  return override('LOG_LEVEL', level);
}
