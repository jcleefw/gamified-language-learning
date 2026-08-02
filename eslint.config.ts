import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
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
      // the async storage contract migration relies on
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
    // shelving/ and review/ never import learn/ — see packages/srs-engine/RULES.md
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
    // no consumer outside srs-engine imports the bare package — see
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
    // srs-demo may not import @gll/srs-engine/review (review scheduling) or @gll/db
    // (storage access) — both are server-side concerns. Blacklist, not an allowlist —
    // every other consumer may import /review freely. Also may not reach into
    // apps/server or apps/cli-demo-db's source directly — a deployed client/server
    // pair talks over HTTP via @gll/api-contract, not by importing each other's
    // files. Bans live here, not in a separate block, because flat config replaces
    // (not merges) no-restricted-imports options across blocks whose files overlap.
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
            {
              name: '@gll/db',
              message:
                'db access is server-side only — apps/srs-demo talks to server over HTTP.',
            },
            {
              name: '@gll/server',
              message: "apps must not import each other's source directly.",
            },
            {
              name: 'cli-demo-db',
              message: "apps must not import each other's source directly.",
            },
          ],
          patterns: [
            {
              group: ['**/server/**', '**/cli-demo-db/**'],
              message: "apps must not import each other's source directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // apps/server must not reach into apps/srs-demo or apps/cli-demo-db's source
    // directly — same mutual-isolation rule as the srs-demo block above. Also
    // restates the bare @gll/srs-engine ban already enforced by the block above
    // this one, because flat config replaces (not merges) no-restricted-imports
    // options across blocks whose files overlap — without restating it here,
    // this block would silently drop that ban for apps/server.
    files: ['apps/server/**/*.ts'],
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
            {
              name: '@gll/srs-demo',
              message: "apps must not import each other's source directly.",
            },
            {
              name: 'cli-demo-db',
              message: "apps must not import each other's source directly.",
            },
          ],
          patterns: [
            {
              group: ['**/srs-demo/**', '**/cli-demo-db/**'],
              message: "apps must not import each other's source directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // apps/cli-demo-db must not reach into apps/server or apps/srs-demo's source
    // directly — same mutual-isolation rule as the two blocks above. Also restates
    // the bare @gll/srs-engine ban for the same reason as the apps/server block.
    files: ['apps/cli-demo-db/**/*.ts'],
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
            {
              name: '@gll/server',
              message: "apps must not import each other's source directly.",
            },
            {
              name: '@gll/srs-demo',
              message: "apps must not import each other's source directly.",
            },
          ],
          patterns: [
            {
              group: ['**/server/**', '**/srs-demo/**'],
              message: "apps must not import each other's source directly.",
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
    // no import cycles among apps/srs-demo's composables. Severity
    // starts at 'warn' until the baseline cycle count is measured and reported.
    files: ['apps/srs-demo/src/composables/**/*.ts'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': { typescript: true },
      'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
    },
    rules: {
      'import/no-cycle': 'warn',
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
    // the body wraps synchronous better-sqlite3 calls with zero internal `await`.
    // require-await doesn't apply here.
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
