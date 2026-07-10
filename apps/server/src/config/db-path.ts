import path from 'node:path';

/**
 * Repo root, anchored to THIS file's location (apps/server/src/config → up 4).
 * Both the server (index.ts) and the seed CLI import this so their default DB path
 * is computed identically regardless of each entry point's own directory depth.
 */
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../../..');

/**
 * Resolve the SQLite DB path the server (and the seed CLI) opens. Single source of
 * truth so the CLI never seeds a different file than the running server reads:
 * `GLL_DB_PATH` if set, else `<projectRoot>/.data/srs-demo.db`.
 */
export function resolveDbPath(env: NodeJS.ProcessEnv, projectRoot: string): string {
  return env.GLL_DB_PATH
    ? path.resolve(env.GLL_DB_PATH)
    : path.resolve(projectRoot, '.data/srs-demo.db');
}

/** The default DB path both entry points use — resolveDbPath anchored at PROJECT_ROOT. */
export function defaultDbPath(env: NodeJS.ProcessEnv): string {
  return resolveDbPath(env, PROJECT_ROOT);
}
