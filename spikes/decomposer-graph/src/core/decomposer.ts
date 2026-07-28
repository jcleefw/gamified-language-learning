// PURE FUNCTIONS. No corpus data here; operates on the foundation lookups.
// The deterministic core: script → class → syllable-type → tone, then a typed graph.
import {
  CLASS,
  MARK_GLYPH,
  MARK_NAME,
  ONSET,
  RULESET_VERSION,
  SONORANT,
  STOP,
  TONE_DIACRITIC,
  TONE_LABEL,
  VOWEL_TABLE,
} from './foundation'
import type {
  ConsonantClass,
  DecomposedSyllable,
  DecomposedWord,
  Graph,
  GraphEdge,
  GraphNode,
  Grapheme,
  MarkKey,
  RawSyllable,
  RawWord,
  Relation,
  RelationKey,
  Tone,
} from './types'
import { decomposeGraphemes } from './graphemeParser'
import type { GraphemeException } from './graphemeParser'

export { RULESET_VERSION }

/** Check if a syllable is live input (has thai field) vs hand-authored (has initial field). */
function isLiveSyllable(s: RawSyllable | any): s is { thai: string; forceTone?: string } {
  return 'thai' in s && !('initial' in s)
}

/** Compute RawSyllable from Thai text using the parser, with fallback exception handling. */
function computeRawSyllable(
  text: string,
  forceTone?: any,
): RawSyllable | { exception: string } {
  const result = decomposeGraphemes(text)
  if ('exception' in result) {
    return result
  }
  return forceTone ? { ...result, forceTone } : result
}

export const RELATIONS: Record<RelationKey, Relation> = {
  'has-initial': { via: 'consonant', label: 'shares initial consonant' },
  'has-class': { via: 'class', label: 'same consonant class' },
  'fired-rule': { via: 'rule', label: 'same fired tone rule' },
  'has-tone': { via: 'tone', label: 'same tone' },
  'has-vowel': { via: 'vowel', label: 'shares vowel' },
  'has-mark': { via: 'mark', label: 'same tone mark' },
  'in-field': { via: 'field', label: 'same meaning field' },
}

/** The crown jewel: tone as a pure function of the fixed foundation. */
export function computeTone(
  cls: ConsonantClass,
  mark: MarkKey | null,
  isLive: boolean,
  vowelLong: boolean,
): Tone {
  if (mark === 'ek') return cls === 'low' ? 'falling' : 'low'
  if (mark === 'tho') return cls === 'low' ? 'high' : 'falling'
  if (mark === 'tri') return 'high'
  if (mark === 'chattawa') return 'rising'
  if (cls === 'mid') return isLive ? 'mid' : 'low'
  if (cls === 'high') return isLive ? 'rising' : 'low'
  return isLive ? 'mid' : vowelLong ? 'falling' : 'high' // low class
}

export function liveness(final: string | null, vowelLong: boolean): boolean {
  if (final && SONORANT[final]) return true
  if (final && STOP[final]) return false
  return !!vowelLong
}

/** canonical vowel pattern (◌-notation) → romanized vowel, from the foundation table. */
const VOWEL_ROM: Record<string, string> = {}
for (const v of VOWEL_TABLE) VOWEL_ROM[v.canonical] = v.rom

/** Place a tone's combining diacritic on the first letter of the romanized vowel. */
function placeTone(vowelRom: string, tone: Tone): string {
  const dia = TONE_DIACRITIC[tone]
  if (!dia || !vowelRom) return vowelRom
  return vowelRom[0] + dia + vowelRom.slice(1)
}

/**
 * Layer-1 romanization of one syllable: onset consonant(s) + vowel (carrying the
 * tone diacritic) + coda. Pure — driven entirely by the foundation lookups, no
 * dictionary or LLM. อ is a zero onset; the silent ห/อ leader and การันต์ final
 * are not voiced, so neither is romanized. The tone is passed in (already computed
 * by computeTone, forceTone applied) so romanization and tone never diverge.
 */
export function computeRomanization(raw: RawSyllable, tone: Tone): string {
  const onset =
    (ONSET[raw.initial] ?? '') +
    (raw.clusterConsonant ? ONSET[raw.clusterConsonant] ?? '' : '')
  const vowel = placeTone(VOWEL_ROM[raw.vowel] ?? '', tone)
  const coda = raw.final ? SONORANT[raw.final] || STOP[raw.final] || '' : ''
  return onset + vowel + coda
}

function graphemesOf(s: RawSyllable): Grapheme[] {
  const g: Grapheme[] = []
  if (s.leadingSilent) g.push({ glyph: s.leadingSilent, role: 'silent leader', silent: true })
  g.push({ glyph: s.initial, role: s.clusterConsonant ? 'cluster (tone)' : 'initial' })
  if (s.clusterConsonant) g.push({ glyph: s.clusterConsonant, role: 'cluster' })
  g.push({ glyph: s.vowel.replace('◌', '▭'), role: s.long ? 'vowel · long' : 'vowel · short' })
  if (s.final) g.push({ glyph: s.final, role: 'final /' + (SONORANT[s.final] || STOP[s.final]) + '/' })
  if (s.silentFinal) g.push({ glyph: s.silentFinal, role: 'การันต์ · silent', silent: true })
  if (s.mark) g.push({ glyph: MARK_GLYPH[s.mark], role: MARK_NAME[s.mark] })
  return g
}

/**
 * Turn externally-segmented syllable strings (e.g. PyThaiNLP) into the
 * authored RawSyllable[] shape words.json stores. Same parser decompose()
 * uses internally for live input — this just stops short of computing tone,
 * so the result can be written straight into the corpus. Returns an
 * exception instead of a partial/guessed syllable if any one fails to parse.
 */
export function breakdownSyllableToCorpus(texts: string[]): RawSyllable[] | { exception: string } {
  const syllables: RawSyllable[] = []
  for (const text of texts) {
    const result = decomposeGraphemes(text)
    if ('exception' in result) return { exception: result.exception }
    syllables.push(result)
  }
  return syllables
}

export function decompose(w: RawWord): DecomposedWord {
  const syllables: DecomposedSyllable[] = []
  const parseExceptions: string[] = []

  for (const s of w.syllables) {
    let rawSyllable: RawSyllable | { exception: string }
    if (isLiveSyllable(s)) {
      rawSyllable = computeRawSyllable(s.thai, s.forceTone)
      if ('exception' in rawSyllable) {
        parseExceptions.push(rawSyllable.exception)
        continue
      }
    } else {
      rawSyllable = s
    }

    const cls = CLASS[rawSyllable.leadingSilent || rawSyllable.initial]
    // ไ ใ ำ เ-า end in a glide → always LIVE syllables, regardless of vowel length
    const glideLive =
      /[ไใ]/.test(rawSyllable.vowel) ||
      rawSyllable.vowel.includes('ำ') ||
      (rawSyllable.vowel.includes('เ') && rawSyllable.vowel.includes('า'))
    const isLive = glideLive || liveness(rawSyllable.final, rawSyllable.long)
    const ruleTone = computeTone(cls, rawSyllable.mark, isLive, rawSyllable.long)
    const tone = rawSyllable.forceTone || ruleTone
    const overridden = !!rawSyllable.forceTone && rawSyllable.forceTone !== ruleTone
    const ruleId = `${cls}·${rawSyllable.mark || '—'}·${isLive ? 'live' : 'dead'}${
      cls === 'low' && !isLive ? (rawSyllable.long ? '·long' : '·short') : ''
    }→${tone}`
    const base = `${cls.toUpperCase()} ${
      rawSyllable.mark ? '+ ' + MARK_NAME[rawSyllable.mark] : '· no mark'
    } · ${isLive ? 'live' : 'dead'}`

    syllables.push({
      graphemes: graphemesOf(rawSyllable),
      initial: rawSyllable.initial,
      leadingSilent: rawSyllable.leadingSilent || null,
      cluster: rawSyllable.clusterConsonant || null,
      class: cls,
      vowelLength: rawSyllable.long ? 'long' : 'short',
      syllableType: isLive ? 'live' : 'dead',
      toneMark: rawSyllable.mark || null,
      toneMarkName: rawSyllable.mark ? MARK_NAME[rawSyllable.mark] : null,
      romanization: computeRomanization(rawSyllable, tone),
      firedRuleId: ruleId,
      firedRuleLabel: overridden
        ? `${base} → ${TONE_LABEL[ruleTone]} by rule · irregular → ${TONE_LABEL[tone]}`
        : `${base} → ${TONE_LABEL[tone]}`,
      firedRuleShort: `${cls.toUpperCase()}+${rawSyllable.mark || '∅'}→${TONE_LABEL[tone]}`,
      tone,
      ruleTone,
      overridden,
    })
  }

  const hasParseErrors = parseExceptions.length > 0
  const exceptionMsg = hasParseErrors ? `Parse: ${parseExceptions.join('; ')}` : w.note || null

  return {
    thai: w.thai,
    // Computed Layer-1 romanization (never the authored field) — the whole point of Slice 7.
    romanization: syllables.map((s) => s.romanization).join('-'),
    gloss: w.gloss,
    fields: w.field,
    status: w.note || hasParseErrors ? ('exception' as const) : ('clean' as const),
    exception: exceptionMsg,
    syllables,
  }
}

/** Build the typed node/edge graph from an array of authored words. */
export function buildGraph(words: RawWord[]): Graph {
  const nodesMap = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const seenEdge = new Set<string>()

  const upsert = (
    id: string,
    type: GraphNode['type'],
    label: string,
    extra: Partial<GraphNode> = {},
  ): GraphNode => {
    if (!nodesMap.has(id)) nodesMap.set(id, { id, type, label, ...extra })
    return nodesMap.get(id)!
  }
  const edge = (source: string, target: string, relation: RelationKey): void => {
    const k = source + '|' + target + '|' + relation
    if (seenEdge.has(k)) return
    seenEdge.add(k)
    edges.push({ source, target, relation })
  }

  const decomposed = words.map(decompose)
  for (const d of decomposed) {
    const wid = 'W:' + d.thai
    upsert(wid, 'word', d.thai, { thai: true, word: d })
    for (const s of d.syllables) {
      upsert('C:' + s.initial, 'consonant', s.initial, { thai: true })
      edge(wid, 'C:' + s.initial, 'has-initial')
      upsert('CL:' + s.class, 'class', s.class.toUpperCase())
      edge(wid, 'CL:' + s.class, 'has-class')
      upsert('T:' + s.tone, 'tone', TONE_LABEL[s.tone])
      edge(wid, 'T:' + s.tone, 'has-tone')
      upsert('R:' + s.firedRuleId, 'rule', s.firedRuleShort, { ruleId: s.firedRuleId })
      edge(wid, 'R:' + s.firedRuleId, 'fired-rule')
      const vGlyph = s.graphemes.find((g) => g.role.startsWith('vowel'))!.glyph
      const vId = 'V:' + s.vowelLength + ':' + vGlyph
      upsert(vId, 'vowel', vGlyph, { thai: true })
      edge(wid, vId, 'has-vowel')
      if (s.toneMark) {
        upsert('M:' + s.toneMark, 'mark', MARK_GLYPH[s.toneMark], {
          thai: true,
          name: MARK_NAME[s.toneMark],
        })
        edge(wid, 'M:' + s.toneMark, 'has-mark')
      }
    }
    for (const f of d.fields) {
      upsert('F:' + f, 'field', f)
      edge(wid, 'F:' + f, 'in-field')
    }
  }

  // degree + signal (specificity in bits) on every attribute node
  const corpus = decomposed.length
  const wordDegree = new Map<string, number>()
  for (const e of edges) wordDegree.set(e.target, (wordDegree.get(e.target) || 0) + 1)
  for (const node of nodesMap.values()) {
    if (node.type === 'word') continue
    node.wordsCovered = wordDegree.get(node.id) || 0
    node.signalBits = +(-Math.log2(node.wordsCovered / corpus)).toFixed(2)
  }
  return { corpus, nodes: [...nodesMap.values()], edges, relations: RELATIONS }
}
