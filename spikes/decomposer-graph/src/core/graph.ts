// A generic graph reader — no Thai knowledge here. It knows only nodes and
// typed edges, and answers neighbourhood / related-word / shortest-path queries.
import type { Graph, GraphNode, RelationKey } from './types'

export interface Adjacency {
  to: string
  rel: RelationKey
}

export class GraphReader {
  readonly meta: { corpus: number; rulesetVersion: string; relations: Graph['relations'] }
  private readonly nodes = new Map<string, GraphNode>()
  private readonly adj = new Map<string, Adjacency[]>()

  constructor(graph: Graph, rulesetVersion: string) {
    this.meta = { corpus: graph.corpus, rulesetVersion, relations: graph.relations }
    for (const n of graph.nodes) {
      this.nodes.set(n.id, n)
      this.adj.set(n.id, [])
    }
    for (const e of graph.edges) {
      this.adj.get(e.source)!.push({ to: e.target, rel: e.relation })
      this.adj.get(e.target)!.push({ to: e.source, rel: e.relation })
    }
  }

  get size(): number {
    return this.nodes.size
  }

  has(id: string): boolean {
    return this.nodes.has(id)
  }

  node(id: string): GraphNode {
    const n = this.nodes.get(id)
    if (!n) throw new Error(`unknown node: ${id}`)
    return n
  }

  allNodes(): GraphNode[] {
    return [...this.nodes.values()]
  }

  words(): GraphNode[] {
    return this.allNodes().filter((n) => n.type === 'word')
  }

  neighbours(id: string): Adjacency[] {
    return this.adj.get(id) || []
  }

  isWord(id: string): boolean {
    return this.node(id).type === 'word'
  }

  /** otherWordId → set of shared attribute-node ids (optionally filtered by relation). */
  relatedWords(wid: string, rels?: RelationKey[]): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>()
    for (const { to, rel } of this.neighbours(wid)) {
      if (rels && !rels.includes(rel)) continue
      for (const { to: w } of this.neighbours(to)) {
        if (this.isWord(w) && w !== wid) {
          let set = out.get(w)
          if (!set) {
            set = new Set()
            out.set(w, set)
          }
          set.add(to)
        }
      }
    }
    return out
  }

  /** Breadth-first shortest path between two node ids, or null. */
  findPath(a: string, b: string): string[] | null {
    const q: string[][] = [[a]]
    const seen = new Set([a])
    while (q.length) {
      const p = q.shift()!
      const last = p[p.length - 1]
      if (last === b) return p
      for (const { to } of this.neighbours(last)) {
        if (!seen.has(to)) {
          seen.add(to)
          q.push([...p, to])
        }
      }
    }
    return null
  }
}
