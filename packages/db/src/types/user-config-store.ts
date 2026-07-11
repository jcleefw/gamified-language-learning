/** One user's config overrides. Every field is nullable — `null` means "no
 *  override", resolved to the server's base/preset default at the read path
 *  (DS02). `difficultyPreset` is a preset NAME (a plain string at this layer;
 *  the server owns the name→bundle map and validates the name), never a raw
 *  threshold integer. */
export interface UserConfigRecord {
  difficultyPreset: string | null;
  wordsPerBatch: number | null;
  sentenceDirections: string[] | null;
}

/** Per-user config override store. Absent row ⟺ "no overrides". */
export interface IUserConfigStore {
  /** null ⟺ user has no config row (⟺ no overrides). */
  get(userId: string): Promise<UserConfigRecord | null>;
  /** Upsert by user_id; partial — only provided fields are written, others left untouched. */
  put(userId: string, patch: Partial<UserConfigRecord>): Promise<void>;
}
