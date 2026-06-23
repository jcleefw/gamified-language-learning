import { fileURLToPath } from 'url';
import { getDb, closeDb } from '@gll/db';
import { clearUserState, resetDb, seedDb, type DbClient } from './db-tools.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const DB_PATH = process.env.GLL_DB_PATH ?? './data/learning-state.db';

  if (command === 'clear') {
    const db = getDb(DB_PATH) as DbClient;
    clearUserState(db, 'cli-user');
    console.log('[INFO] Cleared user state for cli-user.');
    closeDb();
  } else if (command === 'reset') {
    resetDb(DB_PATH);
    console.log('[INFO] DB reset — schema reinitialised. Run engine:import-curriculum to reimport curriculum.');
    closeDb();
  } else if (command === 'seed') {
    const fixtureName = process.argv[3];
    if (!fixtureName) {
      console.error('[ERROR] seed requires a fixture name. Usage: db-tools-cli seed <fixture-name>');
      process.exit(1);
    }
    const db = getDb(DB_PATH) as DbClient;
    seedDb(fixtureName, db, 'cli-user');
    console.log(`[INFO] Seeded fixture "${fixtureName}" for cli-user.`);
    closeDb();
  } else {
    console.error(`[ERROR] Unknown command "${command ?? ''}". Available: clear | reset | seed <fixture-name>`);
    process.exit(1);
  }
}
