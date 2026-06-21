import Database from 'better-sqlite3';
import path from 'path';
import { readFileSync, readdirSync } from 'fs';

const dbPath = './data/test-learning-state.db';

// Initialize DB
const db = new Database(dbPath);

const tableName = '__drizzle_migrations__';
db.exec(`
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const migrationsDir = path.join(process.cwd(), 'packages/srs-engine-v2/drizzle/migrations');
const files = readdirSync(migrationsDir, { withFileTypes: true });
const migrationFiles = files.filter(f => f.isFile() && f.name.endsWith('.sql')).sort((a, b) => a.name.localeCompare(b.name));

console.log(`Found ${migrationFiles.length} migration files`);

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file.name);
  const migrationId = file.name.replace('.sql', '');
  
  const sql = readFileSync(filePath, 'utf-8');
  console.log(`Applying migration ${migrationId}...`);
  db.exec(sql);
  
  db.exec(`INSERT INTO ${tableName} (id, hash, created_at) VALUES ('${migrationId}', '${migrationId}', ${Date.now()})`);
}

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '%__drizzle%'").all();
console.log(`Created ${tables.length} tables:`, tables.map(t => t.name).join(', '));

db.close();
console.log('✓ Database initialized successfully');
