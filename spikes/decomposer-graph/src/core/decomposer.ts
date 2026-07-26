// PURE FUNCTIONS. No corpus data here; operates on the foundation lookups.
// The deterministic core: script → class → syllable-type → tone, then a typed graph.
import {
  CLASS,
  MARK_GLYPH,
  MARK_NAME,
  RULESET_VERSION,
  SONORANT,
  STOP,
  TONE_LABEL,
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

export { RULESET_VERSION }

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

export function decompose(w: RawWord): DecomposedWord {
  const syllables: DecomposedSyllable[] = w.syllables.map((s) => {
    const cls = CLASS[s.leadingSilent || s.initial]
    // ไ ใ ำ เ-า end in a glide → always LIVE syllables, regardless of vowel length
    const glideLive =
      /[ไใ]/.test(s.vowel) || s.vowel.includes('ำ') || (s.vowel.includes('เ') && s.vowel.includes('า'))
    const isLive = glideLive || liveness(s.final, s.long)
    const ruleTone = computeTone(cls, s.mark, isLive, s.long)
    const tone = s.forceTone || ruleTone // irregulars declare the real tone
    const overridden = !!s.forceTone && s.forceTone !== ruleTone
    const ruleId = `${cls}·${s.mark || '—'}·${isLive ? 'live' : 'dead'}${
      cls === 'low' && !isLive ? (s.long ? '·long' : '·short') : ''
    }→${tone}`
    const base = `${cls.toUpperCase()} ${s.mark ? '+ ' + MARK_NAME[s.mark] : '· no mark'} · ${
      isLive ? 'live' : 'dead'
    }`
    return {
      graphemes: graphemesOf(s),
      initial: s.initial,
      leadingSilent: s.leadingSilent || null,
      cluster: s.clusterConsonant || null,
      class: cls,
      vowelLength: s.long ? 'long' : 'short',
      syllableType: isLive ? 'live' : 'dead',
      toneMark: s.mark || null,
      toneMarkName: s.mark ? MARK_NAME[s.mark] : null,
      firedRuleId: ruleId,
      firedRuleLabel: overridden
        ? `${base} → ${TONE_LABEL[ruleTone]} by rule · irregular → ${TONE_LABEL[tone]}`
        : `${base} → ${TONE_LABEL[tone]}`,
      firedRuleShort: `${cls.toUpperCase()}+${s.mark || '∅'}→${TONE_LABEL[tone]}`,
      tone,
      ruleTone,
      overridden,
    }
  })
  return {
    thai: w.thai,
    romanization: w.romanization,
    gloss: w.gloss,
    fields: w.field,
    status: w.note ? 'exception' : 'clean',
    exception: w.note || null,
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
