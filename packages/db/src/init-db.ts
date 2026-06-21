import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface DatabaseConnection {
  exec(sql: string): void;
  prepare?(sql: string): { get(param?: unknown): unknown };
}

/**
 * Get migration history table name
 */
function getMigrationsTableName(): string {
  return '__drizzle_migrations__';
}

/**
 * Initialize database: apply all pending migrations
 */
export function initDb(db: DatabaseConnection): void {
  const tableName = getMigrationsTableName();

  // Create migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Get list of migration files
  const migrationsDir = path.join(__dirname, '..', 'drizzle', 'migrations');

  if (!existsSync(migrationsDir)) {
    console.log('[INFO] No migrations directory found, skipping DB initialization');
    return;
  }

  // Find all .sql migration files (skip meta/ subdirectory)
  const files = readdirSync(migrationsDir, { withFileTypes: true });
  const migrationFiles: string[] = [];

  for (const file of files) {
    if (file.isFile() && file.name.endsWith('.sql')) {
      const fullPath = path.join(migrationsDir, file.name);
      migrationFiles.push(fullPath);
    }
  }

  migrationFiles.sort();

  // Apply each migration that hasn't been applied yet
  for (const filePath of migrationFiles) {
    const fileName = path.basename(filePath);
    const migrationId = fileName.replace('.sql', '');

    // Check if migration already applied
    try {
      const stmt = db.prepare?.(`SELECT 1 FROM ${tableName} WHERE id = ?`);
      const result = stmt?.get(migrationId);

      if (result) {
        console.log(`[INFO] Migration ${migrationId} already applied, skipping`);
        continue;
      }
    } catch {
      // Table might not exist yet on first run, continue
    }

    // Read and apply migration
    const sql = readFileSync(filePath, 'utf-8');
    console.log(`[INFO] Applying migration ${migrationId}...`);
    db.exec(sql);

    // Record that migration was applied
    const now = Date.now();
    try {
      db.exec(
        `INSERT INTO ${tableName} (id, hash, created_at) VALUES ('${migrationId}', '${migrationId}', ${now});`
      );
    } catch (e) {
      console.warn(`[WARN] Failed to record migration ${migrationId}:`, e);
    }
  }

  console.log('[INFO] Database initialization complete');
}
