import type { WordState } from '../src/types.js';
import type { FoundationalCharacter, ConversationWord } from './types.js';

/** Convert a FoundationalCharacter to a fresh WordState (foundational, learning phase). */
export function characterToWordState(
  character: FoundationalCharacter,
): WordState {
  return {
    wordId: `foundational:${character.id}`,
    category: 'foundational',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  };
}

/** Convert conversation uniqueWords to fresh WordStates (curated, learning phase).
 *  Deduplicates by `native` field — first occurrence wins.
 *  Word ID = `curated:${word.native}` (native character as unique key). */
export function conversationWordsToWordStates(
  words: ConversationWord[],
): WordState[] {
  const seen = new Set<string>();
  const wordStates: WordState[] = [];

  for (const word of words) {
    if (seen.has(word.native)) continue;
    seen.add(word.native);

    wordStates.push({
      wordId: `curated:${word.native}`,
      category: 'curated',
      masteryCount: 0,
      phase: 'learning',
      lapseCount: 0,
      correctCount: 0,
      wrongCount: 0,
    });
  }

  return wordStates;
}
