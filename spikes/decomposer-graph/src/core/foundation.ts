// The fixed lookup tables derived from foundation.json. No rule LOGIC here —
// that lives in decomposer.ts. This module only shapes the raw JSON into typed,
// ready-to-index maps.
import foundationJson from '../../data/foundation.json'
import type { ConsonantClass, Foundation, MarkKey } from './types'

export const FOUNDATION = foundationJson as Foundation

/** glyph → consonant class, inverted from FOUNDATION.classes */
export const CLASS: Record<string, ConsonantClass> = {}
for (const [cls, chars] of Object.entries(FOUNDATION.classes)) {
  for (const c of chars) CLASS[c] = cls as ConsonantClass
}

export const SONORANT = FOUNDATION.sonorantFinals
export const STOP = FOUNDATION.stopFinals

/** consonant → onset (syllable-initial) romanization. อ→'' (zero onset). */
export const ONSET = FOUNDATION.onsets
/** computed tone → romanization diacritic (combining mark). mid→''. */
export const TONE_DIACRITIC = FOUNDATION.toneDiacritic

/** All 44 Thai consonant letters, keyed for membership tests. */
export const ALL_CONSONANTS = new Set(
  [...FOUNDATION.classes.mid, ...FOUNDATION.classes.high, ...FOUNDATION.classes.low],
)
export const MARK_GLYPH = FOUNDATION.markGlyph
export const MARK_NAME = FOUNDATION.markName
export const TONE_LABEL = FOUNDATION.toneLabel

export const RULESET_VERSION = FOUNDATION.rulesetVersion

// --- grapheme-parser lookups (graphemeParser.ts) ---

export const LEADING_VOWELS = new Set([...FOUNDATION.leadingVowels])
export const COMBINING_VOWEL = new Set([...FOUNDATION.combiningVowelSigns])
export const NAM_TARGETS = new Set([...FOUNDATION.namTargets])
export const TRUE_CLUSTERS = new Set(FOUNDATION.clusters)
export const THANTHAKHAT = FOUNDATION.thanthakhat
export const VOWEL_TABLE = FOUNDATION.vowelPatterns

/** glyph → mark key, inverted from FOUNDATION.markGlyph */
export const TONE_MARK_GLYPH: Record<string, MarkKey> = {}
for (const [key, glyph] of Object.entries(MARK_GLYPH)) {
  TONE_MARK_GLYPH[glyph] = key as MarkKey
}
