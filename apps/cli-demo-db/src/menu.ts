import './env.js';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

interface MenuAction {
  label: string;
  run: () => Promise<void>;
}

function runScript(relPath: string, args: string[] = [], env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('tsx', [resolve(SCRIPT_DIR, relPath), ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`exited with code ${String(code)}`))));
  });
}

/**
 * Opens a readline interface just for this one prompt and closes it before
 * returning, so stdin is back in normal mode before any child process (which
 * manages its own raw mode for keypress reading) is spawned.
 */
async function choose(prompt: string, options: string[]): Promise<string> {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${String(i + 1)}) ${opt}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (await rl.question('> ')).trim();
      const idx = Number(answer) - 1;
      if (idx >= 0 && idx < options.length) return options[idx]!;
      console.log('Invalid choice, try again.');
    }
  } finally {
    rl.close();
  }
}

const ACTIONS: MenuAction[] = [
  {
    label: 'Run learning demo (engine:real-db)',
    run: () => runScript('learning-runner-db.ts'),
  },
  {
    label: 'Run review session (engine:review)',
    run: async () => {
      const mode = await choose('Review mode:', ['pool (all due cards)', 'deck (cli-deck only)']);
      const REVIEW_MODE = mode.startsWith('deck') ? 'deck' : 'pool';
      await runScript('review-runner-db.ts', [], { REVIEW_MODE });
    },
  },
  {
    label: 'Import curriculum (engine:import-curriculum)',
    run: () => runScript('import-curriculum.ts'),
  },
  {
    label: 'Seed DB scenario',
    run: async () => {
      const scenario = await choose('Scenario:', ['baseline', 'mid-session', 'sentence-ready']);
      await runScript('db-tools-cli.ts', ['seed', scenario]);
    },
  },
  {
    label: 'Seed mock review cards (engine:review:seed)',
    run: () => runScript('seed-mock-reviews.ts'),
  },
  {
    label: 'Clear user state (keeps schema)',
    run: () => runScript('db-tools-cli.ts', ['clear']),
  },
  {
    label: 'Reset DB (drop + recreate schema)',
    run: () => runScript('db-tools-cli.ts', ['reset']),
  },
];

async function main(): Promise<void> {
  console.log('cli-demo-db — interactive menu');
  if (process.env.GLL_DB_PATH) console.log(`(GLL_DB_PATH=${process.env.GLL_DB_PATH})`);

  for (;;) {
    const label = await choose('What do you want to do?', [...ACTIONS.map((a) => a.label), 'Quit']);
    if (label === 'Quit') break;
    const action = ACTIONS.find((a) => a.label === label)!;
    try {
      await action.run();
    } catch (err) {
      console.error(`[ERROR] ${(err as Error).message}`);
    }
  }
}

await main();
