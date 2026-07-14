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
  // No per-line timing: timing is the served WebVTT track (EP43 consumes it via
  // the browser's TextTrack, cue-ID = sentenceId).
}

export interface AppDeckPayload {
  id: string;
  topic: string;
  difficulty?: string;
  register?: string;
  words: AppWordPayload[];
  lines: AppLinePayload[];
  audioUrl?: string; // absent = no current audio row OR public base unset
  vttUrl?: string; // absent = current audio row has no vtt OR public base unset
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
  // No audioStart/audioEnd: per-sentence timing is the WebVTT track bound to the
  // deck's audio binary (WebVTT ADR), not a field on the sentence.
});
export type DeckSentence = z.infer<typeof DeckSentenceSchema>;

export const DeckDocSchema = z.object({
  sentences: z.array(DeckSentenceSchema),
});
export type DeckDoc = z.infer<typeof DeckDocSchema>;
