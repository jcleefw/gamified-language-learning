// ============================================================================
// Types for Graph RAG — concern-centric knowledge model
// ============================================================================
//
// The graph portrays KNOWLEDGE, not work. Its nodes are:
//   - domain:  a workspace unit (apps/*, packages/*) — a grouping of concerns
//   - concern: a named area of knowledge within a domain (a KNOWLEDGE.md heading),
//              carrying the durable prose that describes how that area works
//
// Stories and epics are NOT nodes. They are demoted to provenance metadata on
// each concern (`sources` / `epics` / `prs`) so "which work produced this?" is
// still answerable — the work is the citation, never the skeleton.
//
// NOTE: this deliberately revises the Two-Axis ADR's D7, which made story/epic
// first-class timeline nodes. That axis dominated the picture with work items
// instead of knowledge; here the time axis survives only as provenance. Recorded
// in the D7 amendment (2026-07-19) of the Two-Axis Knowledge Architecture ADR.

export type NodeType =
  | 'domain' // a workspace unit — groups the concerns beneath it
  | 'concern'; // a named area of knowledge within a domain (a KNOWLEDGE.md heading)

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, unknown>;
}

export type EdgeType =
  | 'contains' // domain -> concern   (a domain groups its concerns)
  | 'relates'; // concern -> concern  (two concerns co-evolved in the same epic)

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
