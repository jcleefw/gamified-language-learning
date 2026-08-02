import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { localRules } from './eslint-rules/index.js';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
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
    // Tooling test file — needs the TS parser (no type-aware project; it's
    // not part of any package's tsconfig `include`).
    files: ['eslint-rules/eslint-boundary-rules.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    // EP18-ST01: shelving/ and review/ never import learn/ — see packages/srs-engine/RULES.md
    files: ['packages/srs-engine/src/{shelving,review}/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/learn/*', '**/learn'],
              message:
                'shelving/ and review/ must not import learn/ — see packages/srs-engine/RULES.md',
            },
          ],
        },
      ],
    },
  },
  {
    // EP18-ST02a: no consumer outside srs-engine imports the bare package — see
    // packages/srs-engine/RULES.md (no barrel export; subpaths only).
    files: ['apps/**/*.ts', 'packages/!(srs-engine)/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@gll/srs-engine',
              message:
                'Import a subpath (/learn, /shelving, /review, /data/*) — there is no barrel export.',
            },
          ],
        },
      ],
    },
  },
  {
    // EP18-ST02b: srs-demo may not import @gll/srs-engine/review — review scheduling
    // is a server-side concern. Blacklist, not an allowlist — every other consumer
    // may import /review freely.
    files: ['apps/srs-demo/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@gll/srs-engine/review',
              message:
                'review scheduling is server-side only — see packages/srs-engine/RULES.md',
            },
          ],
        },
      ],
    },
  },
  {
    // packages/logger and packages/shared-utils are leaf packages — no @gll/*
    // import inside either, by construction (not just convention).
    files: ['packages/{logger,shared-utils}/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@gll/*'],
              message:
                'packages/logger and packages/shared-utils are leaf packages — no @gll/* imports allowed.',
            },
          ],
        },
      ],
    },
  },
  {
    // packages/api-contract stays a pure types/contract package — no db/server
    // access or DB-driver import, by construction.
    files: ['packages/api-contract/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@gll/db',
              message:
                'api-contract must stay a pure types package — no db access.',
            },
            {
              name: '@gll/server',
              message:
                'api-contract must stay a pure types package — no server-side deps.',
            },
          ],
          patterns: [
            {
              group: ['drizzle-orm', 'better-sqlite3', '**/packages/db/**'],
              message:
                'api-contract must stay a pure types package — no DB driver or db package reach-through.',
            },
          ],
        },
      ],
    },
  },
  {
    // Comments must stand alone without referencing the epic/story/ADR that
    // produced them — see RULES.md. Warn (not error) so existing violations
    // surface without blocking commits/CI; applies going forward, same as
    // every other rule in this file.
    files: ['apps/**/*.ts', 'packages/**/*.ts'],
    plugins: { local: { rules: localRules } },
    rules: {
      // TODO: see EP18-DS03 need to mark this as `error` once a bulk fixing of linting is complete.
      'local/no-ticket-refs-in-comments': 'warn',
      // A TODO legitimately needs to name the ticket that will resolve it —
      // keep this at 'warn' permanently, even if the rule above is ever
      // escalated to 'error', so a stale TODO can never fail a build.
      'local/todo-ticket-refs-in-comments': 'warn',
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
