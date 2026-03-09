import { describe, it, expect } from 'vitest'
import { characterToWordState, conversationWordsToWordStates } from '../mappers.js'
import type { FoundationalCharacter, ConversationWord } from '../types.js'
import { consonants } from '../samples/foundations-consonants.js'

describe('characterToWordState', () => {
  const testCharacter: FoundationalCharacter = {
    id: 'ko-kai',
    char: 'ก',
    name: 'Ko Kai',
    romanization: 'k',
    language: 'th',
    type: 'consonant',
  }

  it('produces a valid foundational WordState with learning phase and zero counters', () => {
    const result = characterToWordState(testCharacter)

    expect(result).toEqual({
      wordId: 'foundational:ko-kai',
      category: 'foundational',
      masteryCount: 0,
      phase: 'learning',
      lapseCount: 0,
      correctCount: 0,
      wrongCount: 0,
    })
  })

  it('uses the character id as the wordId suffix for a different character', () => {
    const khoKhai: FoundationalCharacter = {
      id: 'kho-khai',
      char: 'ข',
      name: 'Kho Khai',
      romanization: 'kh',
      language: 'th',
      type: 'consonant',
    }
    expect(characterToWordState(khoKhai).wordId).toBe('foundational:kho-khai')
  })
})

describe('conversationWordsToWordStates', () => {
  const testWords: ConversationWord[] = [
    { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective' },
    { native: 'กิน', romanization: 'gin', english: 'to eat', type: 'verb' },
  ]

  it('maps conversation words to curated WordStates with curated:{native} wordId', () => {
    const result = conversationWordsToWordStates(testWords)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      wordId: 'curated:หิว',
      category: 'curated',
      masteryCount: 0,
      phase: 'learning',
      lapseCount: 0,
      correctCount: 0,
      wrongCount: 0,
    })
    expect(result[1]!.wordId).toBe('curated:กิน')
  })

  it('deduplicates by native field — first occurrence wins', () => {
    const wordsWithDuplicates: ConversationWord[] = [
      { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective' },
      { native: 'กิน', romanization: 'gin', english: 'to eat', type: 'verb' },
      { native: 'หิว', romanization: 'hǐw', english: 'hungry (duplicate)', type: 'adjective' },
    ]

    const result = conversationWordsToWordStates(wordsWithDuplicates)

    expect(result).toHaveLength(2)
    expect(result.map((ws) => ws.wordId)).toEqual(['curated:หิว', 'curated:กิน'])
  })

  it('returns empty array for empty input', () => {
    const result = conversationWordsToWordStates([])
    expect(result).toEqual([])
  })
})

describe('integration: foundational consonants', () => {
  it('first 5 consonants (ก ข ค ง จ) map to valid WordStates', () => {
    const firstFive = consonants.slice(0, 5)

    expect(firstFive.map((c) => c.char)).toEqual(['ก', 'ข', 'ค', 'ง', 'จ'])

    const wordStates = firstFive.map(characterToWordState)

    expect(wordStates).toHaveLength(5)
    for (const ws of wordStates) {
      expect(ws.category).toBe('foundational')
      expect(ws.phase).toBe('learning')
      expect(ws.masteryCount).toBe(0)
      expect(ws.wordId).toMatch(/^foundational:.+$/)
    }

    expect(wordStates.map((ws) => ws.wordId)).toEqual([
      'foundational:ko-kai',
      'foundational:kho-khai',
      'foundational:kho-khwai',
      'foundational:ngo-ngu',
      'foundational:cho-chan',
    ])
  })
})

describe('integration: conversation uniqueWords', () => {
  it('conversation uniqueWords map with no duplicate wordIds', () => {
    // Simulate words from multiple conversations with overlapping vocab
    const conversationWords: ConversationWord[] = [
      { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective' },
      { native: 'กิน', romanization: 'gin', english: 'to eat', type: 'verb' },
      { native: 'ไป', romanization: 'bpai', english: 'to go', type: 'verb' },
      { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective' }, // duplicate
      { native: 'ดี', romanization: 'dee', english: 'good', type: 'adjective' },
    ]

    const wordStates = conversationWordsToWordStates(conversationWords)

    const wordIds = wordStates.map((ws) => ws.wordId)
    const uniqueWordIds = new Set(wordIds)
    expect(wordIds.length).toBe(uniqueWordIds.size)
    expect(wordStates).toHaveLength(4)
  })
})
