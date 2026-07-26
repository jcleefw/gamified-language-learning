// Rule-based Thai grapheme parser: raw syllable text -> RawSyllable fields.
// Scope: one already-segmented syllable (word/syllable boundary-finding is a
// separate concern — see the spike plan). Static rule tables only, no dictionary
// lookup, so lexical irregularities (unmarked การันต์ like เพชร) are correctly
// flagged as exceptions rather than guessed.
import {
  ALL_CONSONANTS,
  COMBINING_VOWEL,
  LEADING_VOWELS,
  MARK_GLYPH,
  NAM_TARGETS,
  SONORANT,
  STOP,
  THANTHAKHAT,
  TONE_MARK_GLYPH,
  TRUE_CLUSTERS,
  VOWEL_TABLE,
} from './foundation'
import type { MarkKey, RawSyllable } from './types'

export interface GraphemeException {
  exception: string
}

function isFinal(ch: string): boolean {
  return !!SONORANT[ch] || !!STOP[ch]
}

export function decomposeGraphemes(text: string): RawSyllable | GraphemeException {
  let remaining = text

  // 1. leading vowel (visually precedes the consonant)
  let lead = ''
  if (remaining.length && LEADING_VOWELS.has(remaining[0])) {
    lead = remaining[0]
    remaining = remaining.slice(1)
  }

  // 2. การันต์ — explicit silent final. Only the marked form (์) is decodable
  //    from spelling alone; an unmarked silent final (เพชร) is a genuine
  //    lexical exception and correctly falls through to a parse failure below.
  let silentFinal: string | undefined
  const chars0 = [...remaining]
  const thanthakhatIdx = chars0.indexOf(THANTHAKHAT)
  if (thanthakhatIdx > 0) {
    silentFinal = chars0[thanthakhatIdx - 1] + chars0[thanthakhatIdx]
    chars0.splice(thanthakhatIdx - 1, 2)
    remaining = chars0.join('')
  }

  // 3. tone mark — a combining diacritic, safe to pull out independent of position
  let mark: MarkKey | null = null
  for (const [glyph, key] of Object.entries(TONE_MARK_GLYPH)) {
    const idx = remaining.indexOf(glyph)
    if (idx !== -1) {
      mark = key
      remaining = remaining.slice(0, idx) + remaining.slice(idx + 1)
      break
    }
  }

  // 4. onset: ห/อ นำ silent leader → true cluster → plain initial
  const chars = [...remaining]
  if (!chars.length || !ALL_CONSONANTS.has(chars[0])) {
    return { exception: `no initial consonant found in "${text}"` }
  }
  const c0 = chars[0]
  const c1 = chars[1]
  const isNam = !!c1 && ALL_CONSONANTS.has(c1) && NAM_TARGETS.has(c1) && (c0 === 'ห' || (c0 === 'อ' && c1 === 'ย'))
  const isCluster = !!c1 && ALL_CONSONANTS.has(c1) && TRUE_CLUSTERS.has(c0 + c1)

  let leadingSilent: string | undefined
  let initial: string
  let clusterConsonant: string | undefined
  let onsetLen: number
  if (isNam) {
    leadingSilent = c0
    initial = c1
    onsetLen = 2
  } else if (isCluster) {
    initial = c0
    clusterConsonant = c1
    onsetLen = 2
  } else {
    initial = c0
    onsetLen = 1
  }

  const afterOnset = chars.slice(onsetLen).join('')

  const build = (v: { canonical: string; long: boolean; final: string | null }): RawSyllable => ({
    initial,
    ...(leadingSilent ? { leadingSilent } : {}),
    ...(clusterConsonant ? { clusterConsonant } : {}),
    vowel: v.canonical,
    long: v.long,
    final: v.final,
    mark,
    ...(silentFinal ? { silentFinal } : {}),
  })

  // 5. vowel + final. สระอัว and สระอือ both drop their trailing spacing glyph
  //    (ว / อ) when a final consonant follows — checked before the general
  //    table so e.g. "ืด" (มืด) isn't mistaken for the rare standalone ◌ื.
  if (lead === '' && afterOnset.length === 2 && isFinal(afterOnset[1])) {
    if (afterOnset[0] === 'ว') return build({ canonical: '◌ัว', long: true, final: afterOnset[1] })
    if (afterOnset[0] === 'ื') return build({ canonical: '◌ือ', long: true, final: afterOnset[1] })
  }

  // VOWEL_TABLE is ordered longest-body-first within each lead group (e.g.
  // 'ือ' before the shorter 'ื' it starts with) — this loop depends on that.
  for (const entry of VOWEL_TABLE) {
    if (entry.lead !== lead) continue
    if (!afterOnset.startsWith(entry.body)) continue
    const rest = afterOnset.slice(entry.body.length)
    if (rest.length > 1) continue
    if (rest.length === 1 && !isFinal(rest[0])) continue
    const final = rest.length === 1 ? rest[0] : null
    // เ◌ (no body) is short only when a final follows — เ-ะ with the ะ
    // orthographically dropped; with nothing following it's the rare long
    // open form.
    const long = entry.lead === 'เ' && entry.body === '' ? final === null : entry.long
    return build({ canonical: entry.canonical, long, final })
  }

  return { exception: `no vowel pattern matched for "${text}" (remainder "${afterOnset}" after onset)` }
}

/**
 * Inverse of decomposeGraphemes: renders the orthographic text a RawSyllable
 * describes. Used to derive ground-truth input text per corpus syllable for
 * validation, since words.json doesn't store per-syllable boundary strings.
 */
export function composeSyllableText(s: RawSyllable): string {
  const entry = VOWEL_TABLE.find((e) => e.canonical === s.vowel)
  if (!entry) throw new Error(`unknown canonical vowel "${s.vowel}"`)

  let body = entry.body
  if (s.final && s.vowel === '◌ัว') body = 'ว'
  if (s.final && s.vowel === '◌ือ') body = 'ื'

  let combiningPart = ''
  let spacingPart = ''
  for (const ch of body) {
    if (COMBINING_VOWEL.has(ch)) combiningPart += ch
    else spacingPart += ch
  }

  const markGlyph = s.mark ? MARK_GLYPH[s.mark] : ''
  const onset = (s.leadingSilent ?? '') + s.initial + (s.clusterConsonant ?? '')
  const core = entry.lead + onset + combiningPart + markGlyph + spacingPart
  return core + (s.final ?? '') + (s.silentFinal ?? '')
}
