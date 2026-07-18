import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.nuxt/**',
      '.worktrees/**',
      '**/data/**',
      'packages/srs-engine/src/runner/interactive.ts',
      '**/drizzle.config.ts',
      '**/vitest.config.ts',
      '**/playwright.config.ts',
      'apps/srs-demo/e2e/**',
      // Compile-time-only DTO assertions, not part of tsconfig.json's `include`
      // (only tsconfig.typecheck.json's, via `tsc --noEmit -p`). The package's
      // own lint script already excludes it (`eslint src`); mirror that here so
      // the root glob doesn't sweep it into type-aware linting with no project.
      'packages/api-contract/type-tests/**',
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
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
    // SqliteLearningStore/SqliteContentStore methods are async-over-sync wrappers by design
    // (EP34 ADR, extended to ContentStore by EP35-ST02): the body wraps synchronous
    // better-sqlite3 calls with zero internal `await`. require-await doesn't apply here.
    files: [
      'packages/db/src/sqlite-learning-store.ts',
      'packages/db/src/sqlite-content-store.ts',
      'packages/db/src/sqlite-review-store.ts',
      'packages/db/src/sqlite-answer-event-store.ts',
      'packages/db/src/sqlite-review-answer-event-store.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
);
