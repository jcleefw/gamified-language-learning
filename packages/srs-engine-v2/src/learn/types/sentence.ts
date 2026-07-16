export interface SentenceContext {
  sentenceId: string;
  englishSentence: string; // authored — English grammar may differ from native word order
  wordOrder: string[];     // wordId refs — tile order for all directions
}
