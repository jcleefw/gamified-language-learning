import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { getDb } from '@gll/db';
import { defaultDbPath } from '../config/db-path.js';
import { REVIEW_SCENARIOS } from './scenario-builder.js';
import { runSeed, type RunSeedArgs } from './run-seed.js';
import { DEMO_USER_ID } from '../identity/current-user.js';

const USER_ID = DEMO_USER_ID;

interface CliArgs extends RunSeedArgs {
  list: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { scenario: '', list: false, dryRun: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--count') out.count = Number(argv[++i]);
    else if (a === '--deck') out.deck = argv[++i];
    else positional.push(a);
  }
  out.scenario = positional[0] ?? '';
  return out;
}

function printCatalogue(): void {
  console.log('Scenarios:');
  for (const [name, spec] of Object.entries(REVIEW_SCENARIOS)) {
    console.log(`  ${name.padEnd(16)} ${spec.description}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.list || !args.scenario) {
    printCatalogue();
    process.exit(args.scenario || args.list ? 0 : 1);
  }

  const dbPath = defaultDbPath(process.env);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = getDb(dbPath);

  try {
    const r = await runSeed(args, { db, userId: USER_ID });
    console.log(`✓ ${r.scenario} · deck ${r.deckId}`);
    console.log(`  words: ${r.wordIds.join(', ')}`);
    console.log(
      `  expected → dueNow: ${r.expected.dueNow} · anytime: ${r.expected.anytime} · reviewUnlocked: ${r.expected.reviewUnlocked}`,
    );
    console.log(r.wrote ? '  (written — reload the app to see it)' : '  (dry-run — nothing written)');
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}

void main();
