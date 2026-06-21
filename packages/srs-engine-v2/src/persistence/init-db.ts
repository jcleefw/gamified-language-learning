import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RunnableDb {
  exec(sql: string): void;
}

export function initDb(db: RunnableDb): void {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(sql);
}
