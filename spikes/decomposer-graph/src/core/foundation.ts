// The fixed lookup tables derived from foundation.json. No rule LOGIC here —
// that lives in decomposer.ts. This module only shapes the raw JSON into typed,
// ready-to-index maps.
import foundationJson from '../../data/foundation.json'
import type { ConsonantClass, Foundation } from './types'

export const FOUNDATION = foundationJson as Foundation

/** glyph → consonant class, inverted from FOUNDATION.classes */
export const CLASS: Record<string, ConsonantClass> = {}
for (const [cls, chars] of Object.entries(FOUNDATION.classes)) {
  for (const c of chars) CLASS[c] = cls as ConsonantClass
}

export const SONORANT = FOUNDATION.sonorantFinals
export const STOP = FOUNDATION.stopFinals
export const MARK_GLYPH = FOUNDATION.markGlyph
export const MARK_NAME = FOUNDATION.markName
export const TONE_LABEL = FOUNDATION.toneLabel

export const RULESET_VERSION = FOUNDATION.rulesetVersion
