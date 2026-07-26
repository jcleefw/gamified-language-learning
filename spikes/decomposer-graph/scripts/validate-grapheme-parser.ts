// ORCHESTRATOR only. Runs decomposeGraphemes against every syllable in the
// authored corpus (data/words.json) and reports per-field accuracy. Ground-truth
// input text per syllable is derived via composeSyllableText, since words.json
// doesn't store per-syllable boundary substrings for multi-syllable words.
//
//   run:  pnpm exec tsx scripts/validate-grapheme-parser.ts
import { composeSyllableText, decomposeGraphemes } from '../src/core/graphemeParser'
import { WORDS } from '../src/core/index'
import type { RawSyllable } from '../src/core/types'

const FIELDS: (keyof RawSyllable)[] = [
  'initial',
  'leadingSilent',
  'clusterConsonant',
  'vowel',
  'long',
  'final',
  'mark',
  'silentFinal',
]

const fieldCorrect = new Map(FIELDS.map((f) => [f, 0]))
const fieldTotal = new Map(FIELDS.map((f) => [f, 0]))

let cleanCount = 0
let exactCount = 0
const exceptions: { thai: string; text: string; exception: string }[] = []
const mismatches: { thai: string; text: string; field: string; expected: unknown; got: unknown }[] = []

let total = 0
for (const word of WORDS) {
  for (const syllable of word.syllables) {
    total++
    const text = composeSyllableText(syllable)
    const result = decomposeGraphemes(text)

    if ('exception' in result) {
      exceptions.push({ thai: word.thai, text, exception: result.exception })
      continue
    }

    cleanCount++
    let allMatch = true
    for (const field of FIELDS) {
      const expected = syllable[field]
      const got = result[field]
      fieldTotal.set(field, fieldTotal.get(field)! + 1)
      if (expected === got) {
        fieldCorrect.set(field, fieldCorrect.get(field)! + 1)
      } else {
        allMatch = false
        mismatches.push({ thai: word.thai, text, field, expected, got })
      }
    }
    if (allMatch) exactCount++
  }
}

console.log(`${total} syllables · ${cleanCount} parsed · ${exceptions.length} flagged as exceptions\n`)

console.log('field            correct/total   accuracy')
for (const field of FIELDS) {
  const c = fieldCorrect.get(field)!
  const t = fieldTotal.get(field)!
  const pct = t ? ((100 * c) / t).toFixed(1) : '-'
  console.log(`${field.padEnd(16)} ${String(c).padStart(3)}/${String(t).padEnd(3)}         ${pct}%`)
}

console.log(`\nexact-match syllables: ${exactCount}/${cleanCount}`)

if (exceptions.length) {
  console.log('\nflagged as exceptions (not counted above):')
  for (const e of exceptions) console.log(`  ${e.thai}  "${e.text}"  ${e.exception}`)
}

if (mismatches.length) {
  console.log('\nmismatches:')
  for (const m of mismatches) {
    console.log(`  ${m.thai}  "${m.text}"  ${m.field}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.got)}`)
  }
}
