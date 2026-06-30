// ── Raw curator upload format ─────────────────────────────────────────────────

export interface ConversationComponent {
  thai: string;
  romanization: string;
  english: string;
  type: string;
}

export interface ConversationBreakdown {
  thai: string;
  romanization: string;
  english: string;
  components: ConversationComponent[];
}

export interface ConversationLine {
  speaker: string;
  thai: string;
  english: string;
  romanization: string;
}

export interface ConversationJSON {
  topic: string;
  difficulty?: string;
  register?: string;
  lines: ConversationLine[];
  breakdown: ConversationBreakdown[];
}

// ── importCurriculum input (AppDeck[]) ────────────────────────────────────────

export interface AppWord {
  native: string;
  romanization: string;
  english: string;
  type: string;
  language: 'th';
}

export interface AppLine {
  speaker: string;
  native: string;
  romanization: string;
  english: string;
  words: AppWord[];
}

export interface AppDeck {
  topic: string;
  difficulty?: string;
  register?: string;
  lines: AppLine[];
}

// ── GET /api/decks response (DB-assigned UUIDs) ───────────────────────────────

export interface AppWordPayload {
  id: string;
  native: string;
  romanization: string;
  english: string;
  type: string;
  language: 'th';
}

export interface AppLinePayload {
  sentenceId: string;
  speaker: string;
  native: string;
  romanization: string;
  english: string;
  wordIds: string[];
}

export interface AppDeckPayload {
  id: string;
  topic: string;
  difficulty?: string;
  register?: string;
  words: AppWordPayload[];
  lines: AppLinePayload[];
}

export type GetDecksResponse = AppDeckPayload[];
