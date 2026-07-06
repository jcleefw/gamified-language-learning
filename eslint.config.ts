import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.nuxt/**',
      '.worktrees/**',
      '**/data/**',
      'packages/srs-engine-v2/src/runner/interactive.ts',
      '**/drizzle.config.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      'apps/srs-demo/e2e/**',
    ],
  },
  {
    files: ['apps/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { project: true },
    },
    rules: {
      // EP34-ST04 guardrail: the async storage contract migration (EP34) relies on
      // every LearningStore call being awaited. This is the one type-aware rule the
      // app layer needs for that; the rest of *TypeChecked's rule bundle is out of
      // scope here and would surface unrelated pre-existing issues across apps/**.
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['packages/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { project: true },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      'no-console': 'error',
    },
  },
  {
    // Relax rules that conflict with test patterns
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // SqliteLearningStore methods are async-over-sync wrappers by design (EP34 ADR):
    // the body is byte-for-byte identical to the pre-async version, wrapping synchronous
    // better-sqlite3 calls with zero internal `await`. require-await doesn't apply here.
    files: ['packages/db/src/sqlite-learning-store.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
);
