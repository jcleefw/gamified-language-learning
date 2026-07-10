import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { getDb } from '@gll/db';
import app from './app.js';
import { seedDemoUser, seedContent } from './seed/seed-db.js';
import { defaultDbPath } from './config/db-path.js';

const DB_PATH = defaultDbPath(process.env);

mkdirSync(path.dirname(DB_PATH), { recursive: true });
getDb(DB_PATH);
seedDemoUser(getDb());
if (process.env.GLL_SEED_CONTENT === '1') {
  await seedContent(getDb());
}

serve({ fetch: app.fetch, port: 6060 }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

export default app;
