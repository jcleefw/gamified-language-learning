export interface AppWord {
  id: string
  native: string
  romanization: string
  english: string
  type: string
  language: 'th'
}

export interface AppLine {
  sentenceId: string
  speaker: 'A' | 'B'
  native: string
  romanization: string
  english: string
  words: AppWord[]
}

export interface AppDeck {
  id: string
  topic: string
  lines: AppLine[]
}
