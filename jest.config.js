// WO: WO-INIT-001 — extracted from package.json inline jest config
/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: [
    '<rootDir>/tests/integration',
    '<rootDir>/services',
    '<rootDir>/ui',
  ],
  testMatch: [
    '<rootDir>/tests/integration/**/*.spec.ts',
    '<rootDir>/tests/e2e/**/*.spec.ts',
    '<rootDir>/services/**/src/**/*.spec.ts',
    '<rootDir>/ui/**/*.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2022',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        strictNullChecks: true,
        noImplicitAny: false,
      },
    },
  },
};

module.exports = config;
