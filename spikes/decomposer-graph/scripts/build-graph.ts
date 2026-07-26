// ORCHESTRATOR only. Data lives in data/words.json + data/foundation.json;
// logic lives in src/core. This wires them and emits graph.json — the artifact
// a downstream Graph-RAG step would consume.
//
//   run:  pnpm build:graph
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph, RULESET_VERSION, WORDS } from '../src/core/index'
import type { GraphNode, NodeType } from '../src/core/types'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'graph.json')

const g = buildGraph(WORDS)

const graph = {
  meta: {
    generatedBy: 'build-graph.ts',
    rulesetVersion: RULESET_VERSION,
    source: 'หยาดเพชร (poem)',
    corpus: g.corpus,
    note: 'nodes[].signalBits = -log2(wordsCovered/corpus): higher = more specific = stronger edge.',
    nodeTypes: ['word', 'consonant', 'class', 'vowel', 'mark', 'tone', 'rule', 'field'],
    relations: g.relations,
  },
  nodes: g.nodes,
  edges: g.edges,
}
writeFileSync(out, JSON.stringify(graph, null, 2))

// console summary
const byType = new Map<NodeType, GraphNode[]>()
for (const n of g.nodes) {
  const list = byType.get(n.type) ?? []
  list.push(n)
  byType.set(n.type, list)
}
const wordCount = byType.get('word')?.length ?? 0
console.log(
  `graph.json written · ${g.corpus} words · ${g.nodes.length} nodes · ${g.edges.length} edges\n`,
)
console.log('node type    count   words/node (signal bits)')
const order: NodeType[] = ['word', 'class', 'tone', 'mark', 'rule', 'field', 'vowel', 'consonant']
for (const t of order) {
  if (t === 'word') {
    console.log(`${t.padEnd(11)}  ${String(wordCount).padStart(4)}`)
    continue
  }
  const ns = (byType.get(t) || []).filter((n) => n.type !== 'word')
  if (!ns.length) continue
  const cov = ns.map((n) => n.wordsCovered ?? 0).sort((a, b) => a - b)
  const avgBits = (ns.reduce((a, n) => a + (n.signalBits ?? 0), 0) / ns.length).toFixed(2)
  console.log(
    `${t.padEnd(11)}  ${String(ns.length).padStart(4)}   min=${cov[0]} med=${
      cov[Math.floor(cov.length / 2)]
    } max=${cov[cov.length - 1]}   avg ${avgBits} bits`,
  )
}
