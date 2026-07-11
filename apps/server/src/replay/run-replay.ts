import { readFileSync } from 'node:fs';
import { getDb, SqliteLearningStore } from '@gll/db';
import { defaultDbPath } from '../config/db-path.js';
import { parseArtifact } from './artifact.js';
import { replayArtifact, type ReplayResult } from './replay-artifact.js';
import { makeMemoryLearningStore } from './memory-store.js';
import type { LearningTransitionStore } from '../learning/apply-answer.js';

export interface RunReplayArgs {
  artifactPath: string;
  /** Replay against the app's real DB instead of a fresh :memory: store. */
  existingDb?: boolean;
  env?: NodeJS.ProcessEnv;
  userId: string;
}

export interface RunReplayOutput {
  result: ReplayResult;
  /** Human-readable step table for the CLI. */
  table: string;
}

/**
 * Pure of process concerns (parallels `run-seed`): read+parse the artifact, pick the store
 * (`:memory:` fresh by default, or the zero-config app DB for `--existing-db`), replay, and format
 * a step table. The CLI wrapper owns argv/printing/exit codes.
 */
export async function runReplay(args: RunReplayArgs): Promise<RunReplayOutput> {
  const artifact = parseArtifact(JSON.parse(readFileSync(args.artifactPath, 'utf-8')));

  const store: LearningTransitionStore = args.existingDb
    ? new SqliteLearningStore(getDb(defaultDbPath(args.env ?? process.env)))
    : makeMemoryLearningStore();

  const result = await replayArtifact(artifact, { store, userId: args.userId });
  return { result, table: formatStepTable(artifact.inputs.length, result) };
}

function formatStepTable(total: number, result: ReplayResult): string {
  const lines: string[] = [];
  lines.push(`replayed ${result.steps}/${total} step(s)`);
  if (result.ok) {
    lines.push('✓ byte-exact — no divergence');
  } else if (result.divergence) {
    const d = result.divergence;
    lines.push(`✗ divergence at step ${d.step} (word ${d.input.wordId}, correct=${d.input.correct}, recheck=${d.input.recheck})`);
    lines.push(`  expected: ${JSON.stringify(d.expected)}`);
    lines.push(`  actual:   ${JSON.stringify(d.actual)}`);
  }
  return lines.join('\n');
}
