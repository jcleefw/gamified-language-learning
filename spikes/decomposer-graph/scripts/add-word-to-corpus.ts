// CLI bridge. Turns externally-segmented syllables into a words.json entry
// and appends it to the corpus. No decomposition logic lives here —
// breakdownSyllableToCorpus()/decompose() already do the real work.
//
//   run: echo '{"thai":"น้ำตา","syllables":["น้ำ","ตา"],"gloss":"tears","field":["sorrow"]}' | pnpm exec tsx scripts/add-word-to-corpus.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { breakdownSyllableToCorpus, decompose } from '../src/core/decomposer'
import type { RawWord } from '../src/core/types'

type Input = {
  thai: string
  syllables: string[]
  gloss: string
  field: string[]
  note?: string
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

const here = dirname(fileURLToPath(import.meta.url))
const wordsPath = join(here, '..', 'data', 'words.json')

const raw = await readStdin()
const input: Input = JSON.parse(raw)

const rawSyllables = breakdownSyllableToCorpus(input.syllables)
if ('exception' in rawSyllables) {
  console.error(`exception: ${rawSyllables.exception}`)
  process.exit(1)
}

const word: RawWord = {
  thai: input.thai,
  gloss: input.gloss,
  field: input.field,
  ...(input.note ? { note: input.note } : {}),
  syllables: rawSyllables,
}

const decomposed = decompose(word)

const words: RawWord[] = JSON.parse(readFileSync(wordsPath, 'utf-8'))
if (words.some((w) => w.thai === input.thai)) {
  console.error(`"${input.thai}" already exists in words.json — not adding a duplicate`)
  process.exit(1)
}

const entry: RawWord & { romanization: string } = {
  thai: word.thai,
  romanization: decomposed.romanization,
  gloss: word.gloss,
  field: word.field,
  ...(word.note ? { note: word.note } : {}),
  syllables: rawSyllables,
}

words.push(entry)
writeFileSync(wordsPath, JSON.stringify(words, null, 2) + '\n')
console.log(`added "${input.thai}" (${decomposed.romanization}) to words.json`)
