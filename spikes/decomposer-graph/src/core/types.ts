// Domain types for the Thai decomposer → typed graph pipeline.
// These describe the authored corpus (words.json), the fixed foundation
// (foundation.json), and the node/edge graph the renderer consumes.

export type ConsonantClass = 'mid' | 'high' | 'low'
export type Tone = 'mid' | 'low' | 'falling' | 'high' | 'rising'
export type MarkKey = 'ek' | 'tho' | 'tri' | 'chattawa'
export type SyllableType = 'live' | 'dead'
export type VowelLength = 'long' | 'short'
export type VowelPosition = 'leading' | 'trailing' | 'surrounding'

/** One tone in the inventory. `citationMark` is the mark the tone is NAMED
 *  after, not a mapping to the realised tone — that is computed in computeTone(). */
export interface ToneInfo {
  label: string
  rom: string
  citationMark: string | null
  citationMarkName: string | null
}

/** One vowel in the inventory, keyed by its ◌-notation pattern. */
export interface VowelInfo {
  rom: string
  en: string
  length: VowelLength
  position: VowelPosition
}

/** One entry in the fixed Thai vowel-spelling table (see VOWEL_TABLE in graphemeParser.ts). */
export interface VowelPattern {
  /** '' or one of the leading vowels เ แ โ ใ ไ */
  lead: string
  /** glyphs after the onset (before any final), '' if none */
  body: string
  /** ◌-notation vowel string, matches RawSyllable.vowel */
  canonical: string
  /** romanized vowel (phonetic scheme: ə ʉ ɛ ɔ, length by doubling), e.g. ◌า→'aa', เ◌อ→'əə' */
  rom: string
  long: boolean
}

/** The fixed, finite Thai foundation — pure lookup tables (foundation.json). */
export interface Foundation {
  rulesetVersion: string
  classes: Record<ConsonantClass, string>
  /** onset (syllable-initial) romanization per consonant — distinct from the final maps; อ→'' (zero onset) */
  onsets: Record<string, string>
  sonorantFinals: Record<string, string>
  stopFinals: Record<string, string>
  markGlyph: Record<MarkKey, string>
  markName: Record<MarkKey, string>
  /** romanization diacritic per computed tone (combining marks); mid→'' */
  toneDiacritic: Record<Tone, string>
  /** display label per tone (e.g. 'MID', 'FALLING') */
  toneLabel: Record<Tone, string>
  /** the leading vowels เ แ โ ใ ไ, which visually precede the consonant */
  leadingVowels: string
  /** combining (above/below) vowel signs — precede the tone mark in Unicode order */
  combiningVowelSigns: string
  /** การันต์ marker (์) — a written-but-silent final glyph */
  thanthakhat: string
  /** low-class consonants with no high-class counterpart — the only valid ห/อ นำ targets */
  namTargets: string
  /** real Thai consonant clusters (อักษรควบแท้) exercised in the corpus */
  clusters: string[]
  /** the fixed Thai vowel-spelling table used by decomposeGraphemes/composeSyllableText */
  vowelPatterns: VowelPattern[]
}

/** One authored syllable in words.json, or computed from live Thai text input. */
export interface RawSyllable {
  /** initial (tone-bearing) consonant */
  initial: string
  /** silent leading consonant (ห นำ / อ นำ) */
  leadingSilent?: string
  /** second consonant of a true cluster */
  clusterConsonant?: string
  /** vowel pattern with ◌ standing in for the consonant slot */
  vowel: string
  long: boolean
  /** final consonant, or null */
  final: string | null
  /** tone mark, or null */
  mark: MarkKey | null
  /** การันต์ — a written-but-silent final glyph */
  silentFinal?: string
  /** declared tone for irregulars, overriding the computed rule */
  forceTone?: Tone
}

/** Live input from UI: just the Thai text and optional metadata. */
export interface LiveSyllable {
  thai: string
  forceTone?: Tone
}

/** One authored word in words.json, or from live UI input. */
export interface RawWord {
  thai: string
  /** authored romanization (corpus only); live input computes it — see computeRomanization() */
  romanization?: string
  gloss: string
  field: string[]
  /** note explaining an irregularity, if any */
  note?: string
  /** hand-authored syllables (corpus) or live input syllables */
  syllables: (RawSyllable | LiveSyllable)[]
}

export interface Grapheme {
  glyph: string
  role: string
  silent?: boolean
}

export interface DecomposedSyllable {
  graphemes: Grapheme[]
  initial: string
  leadingSilent: string | null
  cluster: string | null
  class: ConsonantClass
  vowelLength: VowelLength
  syllableType: SyllableType
  toneMark: MarkKey | null
  toneMarkName: string | null
  /** computed Layer-1 romanization for this syllable (onset + vowel[+tone diacritic] + coda) */
  romanization: string
  firedRuleId: string
  firedRuleLabel: string
  firedRuleShort: string
  tone: Tone
  ruleTone: Tone
  overridden: boolean
}

export interface DecomposedWord {
  thai: string
  romanization: string
  gloss: string
  fields: string[]
  status: 'clean' | 'exception'
  exception: string | null
  syllables: DecomposedSyllable[]
}

export type RelationKey =
  | 'has-initial'
  | 'has-class'
  | 'fired-rule'
  | 'has-tone'
  | 'has-vowel'
  | 'has-mark'
  | 'in-field'

export interface Relation {
  via: string
  label: string
}

export type NodeType =
  | 'word'
  | 'consonant'
  | 'class'
  | 'vowel'
  | 'mark'
  | 'tone'
  | 'rule'
  | 'field'

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  thai?: boolean
  /** present on word nodes: the full decomposition */
  word?: DecomposedWord
  /** present on rule nodes: the full rule id */
  ruleId?: string
  /** present on mark nodes: the mark's name */
  name?: string
  /** attribute nodes: how many words connect to this node */
  wordsCovered?: number
  /** attribute nodes: -log2(wordsCovered/corpus) — specificity in bits */
  signalBits?: number
}

export interface GraphEdge {
  source: string
  target: string
  relation: RelationKey
}

export interface Graph {
  corpus: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  relations: Record<RelationKey, Relation>
}
