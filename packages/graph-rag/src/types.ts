// ============================================================================
// Types for Graph RAG — two-axis knowledge model
// ============================================================================
//
// Governed by the Two-Axis Knowledge Architecture ADR (D7). The graph is built
// from exactly two artifacts:
//   - Time axis:   .agents/changelogs/archive/index.json  -> story / epic nodes
//   - Domain axis: {apps,packages}/<unit>/KNOWLEDGE.md     -> domain / concern nodes
//
// An epic is ALWAYS an edge target (via `contains` / `sources` / `fixes`), never
// a grouping node. Grouping is by workspace `domain`. There are no `file:` nodes:
// the graph never duplicates what git already records (Compaction D6).

export type NodeType =
  | 'story' // time axis — one completed unit of work
  | 'epic' // time axis — a rollup of stories; only ever an edge target
  | 'domain' // domain axis — a workspace unit (apps/*, packages/*)
  | 'concern'; // domain axis — a named area within a domain (a KNOWLEDGE.md heading)

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, unknown>;
}

export type EdgeType =
  | 'contains' // epic -> story        (story.epic)
  | 'touches' // story -> domain      (story.domain)
  | 'about' // concern -> domain     (KNOWLEDGE.md heading scoping)
  | 'sources' // domain -> story|epic  (KNOWLEDGE.md `sources` frontmatter — provenance)
  | 'supersedes' // story -> story        (story.supersedes[])
  | 'fixes'; // story -> epic|story   (story.fixes[])

export interface Edge {
  from: string;
  to: string;
  type: EdgeType;
  label: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  summary: {
    totalNodes: number;
    nodesByType: Record<NodeType, number>;
    totalEdges: number;
  };
}

export interface GraphContext {
  query: string;
  relevantNodes: Node[];
  subgraph: {
    nodes: Node[];
    edges: Edge[];
  };
  graphStats: {
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<NodeType, number>;
  };
}

export interface QueryResult {
  query: string;
  answer: string;
  context: string;
  nodes: Node[];
  edges: Edge[];
}
