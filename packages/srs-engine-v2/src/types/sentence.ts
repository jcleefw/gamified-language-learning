export interface SentenceContext {
  sentenceId: string;
  wordOrder: string[]; // wordId refs — single source of truth for tile order across all directions
}
