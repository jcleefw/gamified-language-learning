import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import type { UserConfigJson } from './schema.js';
import type {
  IUserConfigStore,
  UserConfigRecord,
} from './types/user-config-store.js';
import type { DbClient } from './types/db-client.js';

/** Config overrides live as a JSON blob on the identity row (`users.config`).
 *  `get` reads it; `put` is a read-modify-write merge so only provided fields
 *  change. A NULL blob (or a missing user) reads back as `null` = "no overrides". */
export class SqliteUserConfigStore implements IUserConfigStore {
  constructor(private readonly db: DbClient) {}

  private readBlob(userId: string): UserConfigJson | null {
    const row = this.db
      .select({ config: schema.users.config })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();
    return row?.config ?? null;
  }

  async get(userId: string): Promise<UserConfigRecord | null> {
    const blob = this.readBlob(userId);
    if (!blob) return null;
    return {
      difficultyPreset: blob.difficultyPreset ?? null,
      wordsPerBatch: blob.wordsPerBatch ?? null,
      sentenceDirections: blob.sentenceDirections ?? null,
    };
  }

  async put(userId: string, patch: Partial<UserConfigRecord>): Promise<void> {
    // Read-modify-write: merge only the provided keys into the existing blob so
    // absent keys are preserved. (Whole-blob rewrite is inherent to this shape.)
    const current = this.readBlob(userId) ?? {};
    const next: UserConfigJson = { ...current };
    if ('difficultyPreset' in patch) next.difficultyPreset = patch.difficultyPreset;
    if ('wordsPerBatch' in patch) next.wordsPerBatch = patch.wordsPerBatch;
    if ('sentenceDirections' in patch) next.sentenceDirections = patch.sentenceDirections;

    this.db
      .update(schema.users)
      .set({ config: next })
      .where(eq(schema.users.id, userId))
      .run();
  }
}
