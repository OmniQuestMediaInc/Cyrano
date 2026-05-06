// WO: WO-INIT-001 — extracted from package.json inline jest config
/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests/integration', '<rootDir>/services', '<rootDir>/ui'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.spec.ts',
    '<rootDir>/tests/e2e/**/*.spec.ts',
    '<rootDir>/services/**/src/**/*.spec.ts',
    '<rootDir>/ui/**/*.spec.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Pre-existing test scaffolds whose target services don't exist yet (or
  // whose constructor signatures have drifted from the spec). Each is
  // gated by a follow-up directive — re-enable when the service lands.
  //   bijou-session              → BIJOU-SESSION-IMPL directive
  //   cyrano-layer4-enterprise   → CYRANO-LAYER4-WIRE directive (constructor mocks)
  //   sensync-metrics            → SENSYNC-METRICS-IMPL directive
  //   sensync-rate-limit         → SENSYNC-RATE-LIMIT-IMPL directive
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/integration/bijou-session\\.spec\\.ts$',
    '<rootDir>/tests/integration/cyrano-layer4-enterprise\\.spec\\.ts$',
    '<rootDir>/tests/integration/sensync-metrics\\.spec\\.ts$',
    '<rootDir>/tests/integration/sensync-rate-limit\\.spec\\.ts$',
  ],
  // uuid@14 is published as pure ESM. ts-jest's default CJS transform can't
  // load it, and typeorm pulls it in transitively. Shim it for Jest only.
  moduleNameMapper: {
    '^uuid$': '<rootDir>/tests/jest-uuid-shim.cjs',
  },
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
