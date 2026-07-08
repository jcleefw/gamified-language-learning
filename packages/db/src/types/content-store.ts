import type { AppDeck, AppDeckPayload } from '@gll/api-contract';

export interface Sense {
  romanization: string;
  english: string;
  type: string;
}

export interface IContentStore {
  /** All decks, fully assembled into the API-contract read shape. */
  getDecks(): Promise<AppDeckPayload[]>;
  /** One deck by id, or null if absent. Forward-looking — no route consumes it yet (unit-tested only; keep per ADR method-surface Q, drop if still unused at implementation). */
  getDeck(id: string): Promise<AppDeckPayload | null>;
  /** Validate + persist curriculum. Atomic per call; rejects malformed/dangling-ref payloads. */
  importCurriculum(decks: AppDeck[]): Promise<void>;
  close(): Promise<void>;
}
