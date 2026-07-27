// CLI bridge. Assembles a RawWord from externally-supplied syllable
// boundaries (PyThaiNLP) and runs it through the existing decompose().
// No decomposition logic lives here — decompose()/decomposeGraphemes()
// already accept LiveSyllable and do the real work.
//
//   run: echo '{"thai":"น้ำตา","syllables":["น้ำ","ตา"]}' | pnpm exec tsx scripts/decompose-word.ts
import { decompose } from '../src/core/decomposer'
import type { LiveSyllable, RawWord } from '../src/core/types'

type Input = {
  thai: string
  syllables: string[]
  gloss?: string
  field?: string[]
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf-8')
}

const raw = await readStdin()
const input: Input = JSON.parse(raw)

const word: RawWord = {
  thai: input.thai,
  gloss: input.gloss ?? '',
  field: input.field ?? [],
  syllables: input.syllables.map((thai): LiveSyllable => ({ thai })),
}

console.log(JSON.stringify(decompose(word)))
