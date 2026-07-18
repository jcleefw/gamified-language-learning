import type { SentenceContext } from '../types/sentence.js';
import type { SentenceQuestion, SentenceTile } from '../types/quiz.js';
import { LANGUAGE_CONFIG, type WordJoin } from '../../config/language.js';
import { shuffle } from '../utils/shuffle.js';

const DEFAULT_WORD_JOIN: WordJoin = 'space';

function joinTiles(tiles: SentenceTile[], field: keyof Pick<SentenceTile, 'native' | 'romanization'>, language: string): string {
  const wordJoin = (LANGUAGE_CONFIG[language] ?? { wordJoin: DEFAULT_WORD_JOIN }).wordJoin;
  // only native script respects wordJoin — romanization is always space-separated
  const separator = field === 'native' && wordJoin === 'no-space' ? '' : ' ';
  return tiles.map(t => t[field]).join(separator);
}

function buildQuestion(
  ctx: SentenceContext,
  tiles: SentenceTile[],
  direction: SentenceQuestion['direction'],
  prompt: string,
  shouldShuffle: boolean,
): SentenceQuestion {
  return {
    kind: 'word-block',
    sentenceId: ctx.sentenceId,
    direction,
    prompt,
    tiles: shouldShuffle ? shuffle(tiles) : tiles,
    answer: ctx.wordOrder,
  };
}

export function composeSentenceBatch(
  ctx: SentenceContext,
  resolvedTiles: SentenceTile[],
  language: string,
  options?: { shuffle?: boolean },
): SentenceQuestion[] {
  const shouldShuffle = options?.shuffle ?? true;
  const questions: SentenceQuestion[] = [];

  // english-to-native — prompt is the authored English sentence
  questions.push(buildQuestion(ctx, resolvedTiles, 'english-to-native', ctx.englishSentence, shouldShuffle));

  // romanization-to-native — prompt derived from romanization tiles
  questions.push(buildQuestion(ctx, resolvedTiles, 'romanization-to-native', joinTiles(resolvedTiles, 'romanization', language), shouldShuffle));

  // native-to-romanization — prompt derived from native tiles; tile face is romanization
  questions.push(buildQuestion(ctx, resolvedTiles, 'native-to-romanization', joinTiles(resolvedTiles, 'native', language), shouldShuffle));

  return questions;
}
