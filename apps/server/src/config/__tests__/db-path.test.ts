import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveDbPath } from '../db-path.js';

describe('resolveDbPath', () => {
  it('uses GLL_DB_PATH when set', () => {
    expect(resolveDbPath({ GLL_DB_PATH: '/tmp/custom.db' } as NodeJS.ProcessEnv, '/root')).toBe(
      path.resolve('/tmp/custom.db'),
    );
  });

  it('falls back to <projectRoot>/.data/srs-demo.db when unset', () => {
    expect(resolveDbPath({} as NodeJS.ProcessEnv, '/root')).toBe(
      path.resolve('/root', '.data/srs-demo.db'),
    );
  });
});
