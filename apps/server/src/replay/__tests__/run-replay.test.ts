import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { runReplay } from '../run-replay.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, 'fixtures');
const samplesDir = path.join(here, 'samples');

describe('runReplay (CLI core)', () => {
  it('replays a faithful fixture on a fresh :memory: store (exit-0 path)', async () => {
    const { result, table } = await runReplay({
      artifactPath: path.join(fixturesDir, 'faithful-learning-session.json'),
      userId: 'demo-user',
    });
    expect(result.ok).toBe(true);
    expect(result.divergence).toBeNull();
    expect(table).toContain('byte-exact');
  });

  it('reports divergence on a tampered artifact (exit-1 path)', async () => {
    const { result, table } = await runReplay({
      artifactPath: path.join(samplesDir, 'divergent-learning-session.json'),
      userId: 'demo-user',
    });
    expect(result.ok).toBe(false);
    expect(result.divergence?.step).toBe(2);
    expect(table).toContain('divergence at step 2');
  });

  it('throws a readable error on a malformed artifact file', async () => {
    await expect(
      runReplay({ artifactPath: path.join(samplesDir, 'malformed.json'), userId: 'demo-user' }),
    ).rejects.toThrow(/Invalid replay artifact/);
  });
});

describe('fixture runner (regression)', () => {
  const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  it.each(fixtures)('%s replays byte-exact', async (file) => {
    const { result } = await runReplay({ artifactPath: path.join(fixturesDir, file), userId: 'demo-user' });
    expect(result.ok).toBe(true);
  });
});
