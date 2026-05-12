// WO: WO-INIT-001 — Next.js 14+ starter ESLint config
// Legacy config archived at LEGACY_CONFIGS/.eslintrc.js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  env: { node: true, es2022: true, jest: true },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // Uncomment when ui/ Next.js app is bootstrapped and eslint-config-next is installed:
    // 'next/core-web-vitals',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    'no-console': 'warn',
    semi: ['error', 'always'],
  },
  overrides: [
    {
      files: ['*.js', '**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '.next/', 'LEGACY_CONFIGS/'],
  overrides: [
    {
      // Test files: relax no-explicit-any — mocks and stubs legitimately need `any`
      files: ['tests/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
