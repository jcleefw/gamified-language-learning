import { getDb, SqliteContentStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-review';
import { buildScenario, REVIEW_SCENARIOS, type ExpectedOutcome } from './scenario-builder.js';
import { applyBuiltScenario } from './apply-scenario.js';

export interface RunSeedArgs {
  scenario: string;
  count?: number;
  deck?: string;
  dryRun?: boolean;
}

export interface RunSeedResult {
  scenario: string;
  deckId: string;
  wordIds: string[];
  expected: ExpectedOutcome;
  wrote: boolean;
}

const scheduler = new FsrsScheduler();

/**
 * Resolve a named scenario against a deck and (unless dry-run) write it to the DB.
 * Pure of process concerns — the CLI wrapper owns argv/printing/exit codes.
 */
export async function runSeed(
  args: RunSeedArgs,
  deps: { db: ReturnType<typeof getDb>; userId: string },
): Promise<RunSeedResult> {
  const spec = REVIEW_SCENARIOS[args.scenario];
  if (!spec) {
    throw new Error(
      `unknown scenario "${args.scenario}" — must be one of: ${Object.keys(REVIEW_SCENARIOS).join(', ')}`,
    );
  }

  const content = new SqliteContentStore(deps.db);
  const deck = args.deck ? await content.getDeck(args.deck) : (await content.getDecks())[0];
  if (!deck) throw new Error('no deck found to seed from');

  const count = Math.max(1, args.count ?? 3);
  const wordIds = deck.words.slice(0, count).map((w) => w.id);
  if (wordIds.length === 0) throw new Error('deck has no words to seed');

  const built = buildScenario(spec, { wordIds, deckId: deck.id, now: new Date(), scheduler });

  const wrote = !args.dryRun;
  if (wrote) {
    await applyBuiltScenario(built, { db: deps.db, userId: deps.userId });
  }

  return { scenario: spec.name, deckId: deck.id, wordIds, expected: built.expected, wrote };
}
