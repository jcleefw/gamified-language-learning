/** Foundational character — language-agnostic base.
 *  PRD §5.10: base = id, character, name, romanization, language, type.
 *  Language-specific metadata varies (Thai: class/soundClass/IPA; other langs: TBD). */
export interface FoundationalCharacter {
  id: string;
  char: string;
  name: string;
  romanization: string;
  language: string;
  nameThai?: string;
  type: 'consonant' | 'vowel' | 'tone';
  audioFile?: string;
  metadata?: Record<string, unknown>;
}

/** A single word extracted from a conversation breakdown.
 *  `native` is the canonical native-script field — language-agnostic API.
 *  Consumers adapt their language-specific field (e.g. `thai`) to `native`
 *  before passing in. */
export interface ConversationWord {
  native: string; // native script character(s) — source of truth for identity
  romanization: string;
  english: string;
  type: string;
}

/** A conversation deck with dialogue lines and extracted vocabulary. */
export interface Conversation {
  id: string;
  topic: string;
  lines: ConversationLine[];
  difficulty: string;
  register: string;
  uniqueWords: ConversationWord[];
  createdAt?: number; // Unix timestamp ms, from raw JSON
}

/** Defined for completeness; not consumed by any mapper or runner in Stage 1.
 *  Only `uniqueWords` is used. Include if future ST needs full line rendering. */
export interface ConversationLine {
  speaker: string;
  native: string; // native script — language-agnostic
  english: string;
  romanization: string;
}
