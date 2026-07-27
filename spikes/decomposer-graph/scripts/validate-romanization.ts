// ORCHESTRATOR only. Runs computed Layer-1 romanization (decompose → DecomposedWord.romanization)
// against every hand-authored romanization and reports the match rate.
//
// Ground truth is the archived 65-word corpus (data/words.json.backup-*), NOT the live
// data/words.json — the live file is intentionally empty (the graph is built one word at a
// time via the UI). The archive is the only place authored romanizations still live.
//
// A 100% match is NOT expected: the authored data has genuine internal inconsistencies
// (e.g. คว้า→kwáa vs ความ→khwaam; น้ำ→náam vs น้ำตา→nám-taa). Mismatches here are an
// AUDIT of the authored data, not parser failures — the computed value follows the
// consistent Layer-1 rule in every case.
//
//   run:  pnpm exec tsx scripts/validate-romanization.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decompose } from '../src/core/index'
import type { RawWord } from '../src/core/types'

const ARCHIVE = fileURLToPath(
  new URL('../data/words.json.backup-2026-07-27', import.meta.url),
)
const words = JSON.parse(readFileSync(ARCHIVE, 'utf8')) as RawWord[]

const nfc = (s: string) => s.normalize('NFC')

let match = 0
const mismatches: { thai: string; authored: string; computed: string }[] = []

for (const word of words) {
  const authored = word.romanization ?? ''
  const computed = decompose(word).romanization
  if (nfc(authored) === nfc(computed)) {
    match++
  } else {
    mismatches.push({ thai: word.thai, authored, computed })
  }
}

const pct = ((100 * match) / words.length).toFixed(1)
console.log(`romanization match: ${match}/${words.length} = ${pct}%\n`)

if (mismatches.length) {
  console.log('mismatches (thai | authored | computed) — audit of authored data:')
  for (const m of mismatches) {
    console.log(`  ${m.thai.padEnd(10)} ${m.authored.padEnd(12)} -> ${m.computed}`)
  }
}
