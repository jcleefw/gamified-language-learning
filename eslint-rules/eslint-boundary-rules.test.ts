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
