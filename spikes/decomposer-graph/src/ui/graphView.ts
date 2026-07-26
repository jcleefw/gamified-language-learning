// Pure view-model for the graph stage: highlight/relation mappings, the radial
// layout, and edge styling. No React, no DOM — just geometry over a GraphReader.
import type { GraphReader } from '../core/graph'
import type { NodeType, RelationKey } from '../core/types'

export type Hl = 'initial' | 'rule' | 'class' | 'tone' | 'field' | 'none'
export type Hop = 1 | 2 | 3

export const HL_TO_REL: Record<Hl, RelationKey | null> = {
  initial: 'has-initial',
  rule: 'fired-rule',
  class: 'has-class',
  tone: 'has-tone',
  field: 'in-field',
  none: null,
}

export const TYPE_VAR: Record<NodeType, string> = {
  word: '--n-word',
  consonant: '--n-consonant',
  class: '--n-class',
  vowel: '--n-vowel',
  mark: '--n-mark',
  tone: '--n-tone',
  rule: '--n-rule',
  field: '--n-field',
}

export const W = 900
export const H = 620
export const CX = W / 2
export const CY = H / 2

export interface Pos {
  x: number
  y: number
  center?: boolean
}

export interface Wedge {
  label: string
  midAng: number
  color: string
  other: boolean
}

export interface Layout {
  pos: Map<string, Pos>
  wedges: Wedge[]
}

/** signal (bits) → edge thickness */
export function edgeWidth(bits: number): number {
  return 0.5 + Math.max(0, bits) * 0.42
}

export function edgeOpacity(bits: number): number {
  return 0.22 + Math.min(1, bits / 5) * 0.5
}

// Cluster the hop-2 ring into arcs by which attribute they share with the focus
// under the active highlight relation. Same-cluster words sit in the same wedge;
// words unrelated under that relation fall to "other". Mutates pos, returns wedges.
function placeGrouped(
  reader: GraphReader,
  wid: string,
  rw: string[],
  hlRel: RelationKey,
  pos: Map<string, Pos>,
): Wedge[] {
  const R = 268
  const hlMap = reader.relatedWords(wid, [hlRel]) // word -> Set(sharedAttrId)
  const groups = new Map<string, string[]>()
  const other: string[] = []
  for (const w of rw) {
    const set = hlMap.get(w)
    if (set && set.size) {
      const a = [...set][0]
      const g = groups.get(a) ?? []
      g.push(w)
      groups.set(a, g)
    } else {
      other.push(w)
    }
  }
  const ordered = [...groups.entries()].sort((x, y) => y[1].length - x[1].length) // big clusters first
  if (other.length) ordered.push(['__other__', other])
  const total = rw.length
  const nG = ordered.length
  const gap = nG > 1 ? 0.34 : 0
  const step = (Math.PI * 2 - gap * nG) / total
  const color = TYPE_VAR[reader.meta.relations[hlRel].via as NodeType]
  const wedges: Wedge[] = []
  let ang = -Math.PI / 2 + gap / 2
  for (const [attrId, words] of ordered) {
    const start = ang
    for (const w of words) {
      pos.set(w, { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) })
      ang += step
    }
    const midAng = start + ((words.length - 1) * step) / 2
    ang += gap
    const isOther = attrId === '__other__'
    wedges.push({
      label: isOther ? 'other' : reader.node(attrId).label,
      midAng,
      color,
      other: isOther,
    })
  }
  return wedges
}

export function layoutNeighbourhood(
  reader: GraphReader,
  focus: string,
  hop: Hop,
  hl: Hl,
): Layout {
  const pos = new Map<string, Pos>()
  let wedges: Wedge[] = []
  pos.set(focus, { x: CX, y: CY, center: true })

  const uniqAttrs = [...new Set(reader.neighbours(focus).map((n) => n.to))]
  uniqAttrs.forEach((id, k) => {
    const a = (k / uniqAttrs.length) * Math.PI * 2 - Math.PI / 2
    pos.set(id, { x: CX + 150 * Math.cos(a), y: CY + 150 * Math.sin(a) })
  })

  if (hop >= 2) {
    const rw = [...reader.relatedWords(focus).keys()]
    const hlRel = HL_TO_REL[hl]
    if (hlRel && rw.length) {
      wedges = placeGrouped(reader, focus, rw, hlRel, pos)
    } else {
      rw.forEach((id, k) => {
        const a = (k / Math.max(rw.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.13
        pos.set(id, { x: CX + 268 * Math.cos(a), y: CY + 268 * Math.sin(a) })
      })
    }
    if (hop >= 3) {
      const seen = new Set<string>()
      for (const ow of rw) {
        for (const { to } of reader.neighbours(ow)) {
          if (pos.has(to) || reader.isWord(to) || seen.has(to)) continue
          seen.add(to)
          const base = pos.get(ow)!
          const a = Math.atan2(base.y - CY, base.x - CX) + ((seen.size % 5) - 2) * 0.06
          pos.set(to, { x: CX + 300 * Math.cos(a), y: CY + 300 * Math.sin(a) })
        }
      }
    }
  }
  return { pos, wedges }
}

export function layoutPath(path: string[]): Layout {
  const pos = new Map<string, Pos>()
  const n = path.length
  const pad = 90
  const span = W - pad * 2
  path.forEach((id, k) => {
    pos.set(id, {
      x: pad + (n === 1 ? 0 : (span * k) / (n - 1)),
      y: CY + (k % 2 ? 26 : -26),
      center: id === path[0],
    })
  })
  return { pos, wedges: [] }
}
