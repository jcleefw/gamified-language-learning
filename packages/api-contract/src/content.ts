// ── Raw curator upload format ─────────────────────────────────────────────────

import { z } from 'zod';

// Guard 1 — untrusted curator upload (mirrors the ConversationJSON interface)
export const ConversationComponentSchema = z.object({
  thai: z.string().min(1),
  romanization: z.string(),
  english: z.string(),
  type: z.string(),
});
export type ConversationComponent = z.infer<typeof ConversationComponentSchema>;

export const ConversationBreakdownSchema = z.object({
  thai: z.string().min(1),
  romanization: z.string(),
  english: z.string(),
  components: z.array(ConversationComponentSchema),
});
export type ConversationBreakdown = z.infer<typeof ConversationBreakdownSchema>;

export const ConversationLineSchema = z.object({
  speaker: z.string(),
  thai: z.string().min(1),
  english: z.string(),
  romanization: z.string(),
});
export type ConversationLine = z.infer<typeof ConversationLineSchema>;

export const ConversationJSONSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.string().optional(),
  register: z.string().optional(),
  lines: z.array(ConversationLineSchema),
  breakdown: z.array(ConversationBreakdownSchema),
});
export type ConversationJSON = z.infer<typeof ConversationJSONSchema>;

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
  audioStart?: number; // absent = sentence has no marker
  audioEnd?: number;
}

export interface AppDeckPayload {
  id: string;
  topic: string;
  difficulty?: string;
  register?: string;
  words: AppWordPayload[];
  lines: AppLinePayload[];
  audioUrl?: string; // absent = decks.audio_key IS NULL or public base unset
}

export type GetDecksResponse = AppDeckPayload[];

// ── Persisted document (source of truth for the DeckDoc type) ────────────────
// wordId references are validated for *shape* here (non-empty string); resolution
// to a real words.id is a DB concern enforced in importCurriculum (Zod cannot see
// the words table).

export const DeckComponentSchema = z.object({
  wordId: z.string().min(1),
  position: z.number().int().nonnegative(),
  romanization: z.string().optional(),
  english: z.string().optional(),
});
export type DeckComponent = z.infer<typeof DeckComponentSchema>;

export const DeckSentenceSchema = z.object({
  sentenceId: z.string().min(1),
  speaker: z.string(),
  native: z.string().min(1),
  english: z.string(),
  romanization: z.string(),
  position: z.number().int().nonnegative(),
  components: z.array(DeckComponentSchema),
  audioStart: z.number().nonnegative().optional(), // seconds into the deck file
  audioEnd: z.number().nonnegative().optional(), // seconds; play stops here
});
export type DeckSentence = z.infer<typeof DeckSentenceSchema>;

export const DeckDocSchema = z.object({
  sentences: z.array(DeckSentenceSchema),
});
export type DeckDoc = z.infer<typeof DeckDocSchema>;

// ── Marker-authoring hand-off (EP43-DS02) ─────────────────────────────────────
// The Pass-1 marker map: the marker tool (ST04) exports it, `apply-markers`
// (ST05) ingests it. NOT a wire type — it is the file the curator moves between
// the browser tool and the seed/import step. Keyed by the DB `sentenceId` the
// tool read from GET /api/decks; `start`/`end` are seconds-float and land on
// `DeckSentence.audioStart/audioEnd` in place, matched by `sentenceId`. Only
// complete, valid (`end > start ≥ 0`) pairs are ever emitted or accepted — the
// same invariant is enforced on both sides of the hand-off (defence in depth).
export const DeckMarkerSchema = z
  .object({
    start: z.number().nonnegative(),
    end: z.number().nonnegative(),
  })
  .refine((m) => m.end > m.start, {
    message: 'marker end must be greater than start',
  });
export type DeckMarker = z.infer<typeof DeckMarkerSchema>;

export const DeckMarkerMapSchema = z.object({
  deckId: z.string().min(1),
  markers: z.record(z.string().min(1), DeckMarkerSchema),
});
export type DeckMarkerMap = z.infer<typeof DeckMarkerMapSchema>;
