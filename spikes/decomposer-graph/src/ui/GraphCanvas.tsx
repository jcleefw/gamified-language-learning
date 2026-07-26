import { useMemo } from 'react'
import type { GraphReader } from '../core/graph'
import type { NodeType } from '../core/types'
import type { AppState } from './App'
import styles from './GraphCanvas.module.css'
import {
  CX,
  CY,
  edgeOpacity,
  edgeWidth,
  H,
  HL_TO_REL,
  layoutNeighbourhood,
  layoutPath,
  TYPE_VAR,
  W,
} from './graphView'

interface EdgeVis {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  opacity: number
  kind: 'plain' | 'hl' | 'path'
}

interface NodeVis {
  id: string
  cx: number
  cy: number
  r: number
  color: string
  word: boolean
  center: boolean
  dim: boolean
  label: string
  thai: boolean
  labelX: number
  labelY: number
  count: { x: number; y: number; text: string } | null
}

interface WedgeVis {
  key: string
  x: number
  y: number
  color: string
  other: boolean
  label: string
}

const LEGEND: [NodeType, string][] = [
  ['word', 'word'],
  ['consonant', 'consonant'],
  ['class', 'class'],
  ['vowel', 'vowel'],
  ['mark', 'tone mark'],
  ['tone', 'tone'],
  ['rule', 'fired rule'],
  ['field', 'meaning field'],
]

interface GraphCanvasProps {
  reader: GraphReader
  state: AppState
  onWordClick: (id: string) => void
}

export function GraphCanvas({ reader, state, onWordClick }: GraphCanvasProps) {
  const { focus, hop, hl, pathMode, pathPicks } = state

  const { edges, nodes, wedges } = useMemo(() => {
    const pathList =
      pathMode && pathPicks.length === 2 ? reader.findPath(pathPicks[0], pathPicks[1]) : null
    const { pos, wedges: rawWedges } = pathList
      ? layoutPath(pathList)
      : layoutNeighbourhood(reader, focus, hop, hl)
    const pathSet = pathList ? new Set(pathList) : null

    const hlRel = HL_TO_REL[hl]
    const hlAttrs = new Set(
      hlRel ? reader.neighbours(focus).filter((n) => n.rel === hlRel).map((n) => n.to) : [],
    )

    // edges (deduped by unordered endpoint pair)
    const edgeMap = new Map<string, EdgeVis>()
    const attrOf = (a: string, b: string) => (reader.isWord(a) ? b : a)
    const drawEdge = (a: string, b: string) => {
      if (!pos.has(a) || !pos.has(b)) return
      const k = [a, b].sort().join('|')
      if (edgeMap.has(k)) return
      const attr = reader.node(attrOf(a, b))
      const bits = attr.signalBits ?? 2
      const pa = pos.get(a)!
      const pb = pos.get(b)!
      let kind: EdgeVis['kind'] = 'plain'
      let opacity = edgeOpacity(bits)
      if (pathSet) kind = 'path'
      else if (hlAttrs.has(a) || hlAttrs.has(b)) {
        kind = 'hl'
        opacity = 0.95
      }
      edgeMap.set(k, {
        key: k,
        x1: pa.x,
        y1: pa.y,
        x2: pb.x,
        y2: pb.y,
        width: edgeWidth(bits),
        opacity,
        kind,
      })
    }

    if (pathList) {
      for (let i = 0; i < pathList.length - 1; i++) drawEdge(pathList[i], pathList[i + 1])
    } else {
      reader.neighbours(focus).forEach(({ to }) => drawEdge(focus, to))
      if (hop >= 2) {
        reader.relatedWords(focus).forEach((shared, ow) => shared.forEach((at) => drawEdge(at, ow)))
        if (hop >= 3) {
          reader.relatedWords(focus).forEach((_, ow) =>
            reader.neighbours(ow).forEach(({ to }) => {
              if (!reader.isWord(to) && pos.has(to)) drawEdge(ow, to)
            }),
          )
        }
      }
    }

    // nodes
    const nodeVis: NodeVis[] = []
    pos.forEach((p, id) => {
      const nd = reader.node(id)
      const type = nd.type
      const color = `var(${TYPE_VAR[type]})`
      const word = type === 'word'
      const center = !!p.center
      const dim = pathSet
        ? !pathSet.has(id)
        : !!hlRel &&
          type === 'word' &&
          id !== focus &&
          !reader.neighbours(id).some((n) => hlAttrs.has(n.to))
      const r = center ? 34 : word ? 19 : 12
      const inside = nd.thai || word
      const labelY = inside ? p.y + (center ? 8 : word ? 6 : 5) : p.y + r + 13
      const count =
        !word && nd.wordsCovered != null
          ? {
              x: p.x,
              y: inside ? p.y + r + 12 : labelY + 12,
              text: `×${nd.wordsCovered} · ${nd.signalBits}b`,
            }
          : null
      nodeVis.push({
        id,
        cx: p.x,
        cy: p.y,
        r,
        color,
        word,
        center,
        dim,
        label: nd.label,
        thai: !!nd.thai,
        labelX: p.x,
        labelY,
        count,
      })
    })

    // hop-2 cluster labels — only at hop 2 (hop 3 crowds the ring)
    const lr = 306
    const wedgeVis: WedgeVis[] =
      !pathSet && hop === 2
        ? rawWedges.map((w, i) => ({
            key: `${w.label}-${i}`,
            x: CX + lr * Math.cos(w.midAng),
            y: CY + lr * Math.sin(w.midAng) + 3,
            color: w.other ? 'var(--faint)' : `var(${w.color})`,
            other: w.other,
            label: w.label,
          }))
        : []

    return { edges: [...edgeMap.values()], nodes: nodeVis, wedges: wedgeVis }
  }, [reader, focus, hop, hl, pathMode, pathPicks])

  return (
    <div className={styles.stage}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Word neighbourhood graph"
      >
        <g>
          {edges.map((e) => (
            <line
              key={e.key}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              className={[styles.edge, e.kind === 'hl' && styles.hl, e.kind === 'path' && styles.path]
                .filter(Boolean)
                .join(' ')}
              strokeWidth={e.width}
              strokeOpacity={e.opacity}
            />
          ))}
        </g>
        <g>
          {nodes.map((n) => (
            <g
              key={n.id}
              className={[
                styles.node,
                n.center && styles.center,
                n.dim && styles.dim,
                n.word && styles.wordNode,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={n.word ? () => onWordClick(n.id) : undefined}
            >
              <circle
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                fill={n.color}
                fillOpacity={n.word ? 0.16 : 0.22}
                stroke={n.color}
                strokeWidth={n.center ? 2 : 1.5}
                strokeOpacity={0.85}
              />
              <text
                x={n.labelX}
                y={n.labelY}
                textAnchor="middle"
                className={n.thai ? styles.thai : undefined}
                fill={n.color}
                fontWeight={n.center ? 700 : undefined}
              >
                {n.label}
              </text>
              {n.count && (
                <text x={n.count.x} y={n.count.y} textAnchor="middle" className={styles.count}>
                  {n.count.text}
                </text>
              )}
            </g>
          ))}
        </g>
        {wedges.length > 0 && (
          <g>
            {wedges.map((w) => (
              <text
                key={w.key}
                x={w.x}
                y={w.y}
                textAnchor="middle"
                className={styles.wedge}
                fill={w.color}
              >
                {w.label}
              </text>
            ))}
          </g>
        )}
      </svg>
      <div className={styles.legend}>
        {LEGEND.map(([t, lbl]) => (
          <span key={t}>
            <i style={{ background: `var(${TYPE_VAR[t]})` }} />
            {lbl}
          </span>
        ))}
      </div>
      <div className={styles.hint}>
        click a node or chip to re-centre
        <br />
        edge width = signal (bits)
      </div>
    </div>
  )
}
