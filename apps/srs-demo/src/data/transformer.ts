import type { AppDeck, AppWord } from './types'

// AppWord is structurally identical to MockWord — safe to cast as QuizItem
export function deckToQuizItems(deck: AppDeck): AppWord[] {
  const seen = new Set<string>()
  const result: AppWord[] = []
  for (const line of deck.lines) {
    for (const word of line.words) {
      if (!seen.has(word.id)) {
        seen.add(word.id)
        result.push(word)
      }
    }
  }
  return result
}

export function buildWordPool(decks: AppDeck[]): AppWord[] {
  const seen = new Set<string>()
  const result: AppWord[] = []
  for (const deck of decks) {
    for (const line of deck.lines) {
      for (const word of line.words) {
        if (!seen.has(word.id)) {
          seen.add(word.id)
          result.push(word)
        }
      }
    }
  }
  return result
}
