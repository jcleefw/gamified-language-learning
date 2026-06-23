import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { getDb } from '@gll/db';
import app from './app.js';

const DB_PATH = path.resolve(import.meta.dirname, '../../../.data/srs-demo.db');
mkdirSync(path.dirname(DB_PATH), { recursive: true });
getDb(DB_PATH);

serve({ fetch: app.fetch, port: 6060 }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

export default app;
