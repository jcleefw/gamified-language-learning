import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { ESLint } from 'eslint';

const ROOT = process.cwd();

interface Fixture {
  relPath: string;
  content: string;
}

async function withFixture(
  fixture: Fixture,
  run: (relPath: string) => Promise<void>,
): Promise<void> {
  const absPath = path.join(ROOT, fixture.relPath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, fixture.content, 'utf8');
  try {
    await run(fixture.relPath);
  } finally {
    await rm(absPath, { force: true });
  }
}

async function restrictedImportViolations(relPath: string): Promise<number> {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles([relPath]);
  return results[0].messages.filter((m) => m.ruleId === 'no-restricted-imports')
    .length;
}

async function withFixtures(
  fixtures: Fixture[],
  run: (relPaths: string[]) => Promise<void>,
): Promise<void> {
  const absPaths = fixtures.map((f) => path.join(ROOT, f.relPath));
  await Promise.all(
    fixtures.map(async (f, i) => {
      await mkdir(path.dirname(absPaths[i]), { recursive: true });
      await writeFile(absPaths[i], f.content, 'utf8');
    }),
  );
  try {
    await run(fixtures.map((f) => f.relPath));
  } finally {
    await Promise.all(absPaths.map((p) => rm(p, { force: true })));
  }
}

async function cycleViolations(relPaths: string[]): Promise<number> {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(relPaths);
  return results.reduce(
    (sum, r) =>
      sum + r.messages.filter((m) => m.ruleId === 'import/no-cycle').length,
    0,
  );
}

describe('shelving/ and review/ must not import learn/', () => {
  it('flags a shelving/ file importing from learn/', async () => {
    await withFixture(
      {
        relPath: 'packages/srs-engine/src/shelving/__fixtures__/tmp-boundary.ts',
        content: `import { shuffle } from '../learn/utils/shuffle.js';\n\nexport const usesLearn = shuffle;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag a shelving/ file with no learn/ import', async () => {
    await withFixture(
      {
        relPath: 'packages/srs-engine/src/shelving/__fixtures__/tmp-control.ts',
        content: `import { evaluateShelving } from '../policy.js';\n\nexport const usesPolicy = evaluateShelving;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });
});

describe('no consumer outside srs-engine may import the bare package', () => {
  it('flags an app importing the bare @gll/srs-engine specifier', async () => {
    await withFixture(
      {
        relPath: 'apps/server/src/__fixtures__/tmp-bare-import.ts',
        content: `import type { WordState } from '@gll/srs-engine';\n\nexport type Alias = WordState;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag an app importing a real subpath', async () => {
    await withFixture(
      {
        relPath: 'apps/server/src/__fixtures__/tmp-subpath-import.ts',
        content: `import type { WordState } from '@gll/srs-engine/learn';\n\nexport type Alias = WordState;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });
});

describe('srs-demo must not import @gll/srs-engine/review', () => {
  it('flags srs-demo importing /review', async () => {
    await withFixture(
      {
        relPath: 'apps/srs-demo/src/__fixtures__/tmp-review-import.ts',
        content: `import { FsrsScheduler } from '@gll/srs-engine/review';\n\nexport const scheduler = FsrsScheduler;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag server importing /review (blacklist, not allowlist)', async () => {
    await withFixture(
      {
        relPath: 'apps/server/src/__fixtures__/tmp-review-import.ts',
        content: `import { FsrsScheduler } from '@gll/srs-engine/review';\n\nexport const scheduler = FsrsScheduler;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });

  it('flags srs-demo importing @gll/db', async () => {
    await withFixture(
      {
        relPath: 'apps/srs-demo/src/__fixtures__/tmp-db-import.ts',
        content: `import { db } from '@gll/db';\n\nexport const usesDb = db;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });
});

describe('packages/logger and packages/shared-utils must not import other @gll/* packages', () => {
  it('flags packages/logger importing another @gll/* package', async () => {
    await withFixture(
      {
        relPath: 'packages/logger/src/__fixtures__/tmp-boundary.ts',
        content: `import { formatVtt } from '@gll/shared-utils';\n\nexport const usesSharedUtils = formatVtt;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag packages/logger importing a non-@gll/* package', async () => {
    await withFixture(
      {
        relPath: 'packages/logger/src/__fixtures__/tmp-control.ts',
        content: `import pino from 'pino';\n\nexport const usesPino = pino;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });

  it('flags packages/shared-utils importing another @gll/* package', async () => {
    await withFixture(
      {
        relPath: 'packages/shared-utils/src/__fixtures__/tmp-boundary.ts',
        content: `import { logger } from '@gll/logger';\n\nexport const usesLogger = logger;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag packages/shared-utils importing a non-@gll/* module', async () => {
    await withFixture(
      {
        relPath: 'packages/shared-utils/src/__fixtures__/tmp-control.ts',
        content: `import { readFileSync } from 'node:fs';\n\nexport const usesFs = readFileSync;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });
});

describe('packages/api-contract must stay a pure types package', () => {
  it('flags api-contract importing @gll/db', async () => {
    await withFixture(
      {
        relPath: 'packages/api-contract/src/__fixtures__/tmp-db-import.ts',
        content: `import { db } from '@gll/db';\n\nexport const usesDb = db;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('flags api-contract importing @gll/server', async () => {
    await withFixture(
      {
        relPath: 'packages/api-contract/src/__fixtures__/tmp-server-import.ts',
        content: `import { app } from '@gll/server';\n\nexport const usesServer = app;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('flags api-contract importing drizzle-orm', async () => {
    await withFixture(
      {
        relPath: 'packages/api-contract/src/__fixtures__/tmp-drizzle-import.ts',
        content: `import { eq } from 'drizzle-orm';\n\nexport const usesDrizzle = eq;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('flags api-contract importing better-sqlite3', async () => {
    await withFixture(
      {
        relPath: 'packages/api-contract/src/__fixtures__/tmp-sqlite-import.ts',
        content: `import Database from 'better-sqlite3';\n\nexport const usesSqlite = Database;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(1);
      },
    );
  });

  it('does not flag api-contract importing zod', async () => {
    await withFixture(
      {
        relPath: 'packages/api-contract/src/__fixtures__/tmp-control.ts',
        content: `import { z } from 'zod';\n\nexport const usesZod = z;\n`,
      },
      async (relPath) => {
        expect(await restrictedImportViolations(relPath)).toBe(0);
      },
    );
  });
});

describe('apps/srs-demo composables must not have import cycles', () => {
  it('flags a direct 2-file cycle', async () => {
    await withFixtures(
      [
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-cycle-a.ts',
          content: `import { b } from './tmp-cycle-b';\n\nexport const a = 1;\nexport const useA = (): number => a + b;\n`,
        },
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-cycle-b.ts',
          content: `import { a } from './tmp-cycle-a';\n\nexport const b = 2;\nexport const useB = (): number => a + b;\n`,
        },
      ],
      async (relPaths) => {
        expect(await cycleViolations(relPaths)).toBeGreaterThan(0);
      },
    );
  });

  it('flags a transitive 3-file cycle', async () => {
    await withFixtures(
      [
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-transitive-a.ts',
          content: `import { b } from './tmp-transitive-b';\n\nexport const a = 1;\nexport const useA = (): number => a + b;\n`,
        },
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-transitive-b.ts',
          content: `import { c } from './tmp-transitive-c';\n\nexport const b = 2;\nexport const useB = (): number => b + c;\n`,
        },
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-transitive-c.ts',
          content: `import { a } from './tmp-transitive-a';\n\nexport const c = 3;\nexport const useC = (): number => c + a;\n`,
        },
      ],
      async (relPaths) => {
        expect(await cycleViolations(relPaths)).toBeGreaterThan(0);
      },
    );
  });

  it('does not flag a one-way import with no cycle', async () => {
    await withFixtures(
      [
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-nocycle-a.ts',
          content: `import { b } from './tmp-nocycle-b';\n\nexport const useA = (): number => b;\n`,
        },
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-nocycle-b.ts',
          content: `export const b = 2;\n`,
        },
      ],
      async (relPaths) => {
        expect(await cycleViolations(relPaths)).toBe(0);
      },
    );
  });

  it('does not flag a cycle formed only by a type-only back-edge', async () => {
    // A value-imports B; B only `import type`s back from A. Type-only imports
    // erase at compile time and cause no runtime cycle, so this must not flag —
    // a decision worth locking down as a test, not an assumption.
    await withFixtures(
      [
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-typeonly-a.ts',
          content: `import { b } from './tmp-typeonly-b';\n\nexport const a = 1;\nexport type AType = typeof a;\nexport const useA = (): number => a + b;\n`,
        },
        {
          relPath:
            'apps/srs-demo/src/composables/__fixtures__/tmp-typeonly-b.ts',
          content: `import type { AType } from './tmp-typeonly-a';\n\nexport const b = 2;\nexport const identity = (x: AType): AType => x;\n`,
        },
      ],
      async (relPaths) => {
        expect(await cycleViolations(relPaths)).toBe(0);
      },
    );
  });
});
