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
// A third layer sits above both: the `adr` node — a design DECISION (the *why*),
// distinct from realized knowledge (`concern`) and from work (provenance). ADRs
// ingest as-is and start FLOATING; a human links an ADR to the concern(s) it
// governs, and that link is authored back into the ADR's `**Decides:**` field
// (the source of truth — see readers/adr.ts). An ADR with no `decides` edge is
// "decided, not yet built".
//
// NOTE: this deliberately revises the Two-Axis ADR's D7, which made story/epic
// first-class timeline nodes. That axis dominated the picture with work items
// instead of knowledge; here the time axis survives only as provenance, and a
// decision layer is added on top. Recorded in the D7 amendment of the Two-Axis
// Knowledge Architecture ADR.

export type NodeType =
  | 'domain' // a workspace unit — groups the concerns beneath it
  | 'concern' // a named area of knowledge within a domain (a KNOWLEDGE.md heading)
  | 'adr'; // an architecture decision — the *why* behind one or more concerns

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, unknown>;
}

export type EdgeType =
  | 'contains' // domain -> concern   (a domain groups its concerns)
  | 'relates' // concern -> concern  (two concerns co-evolved in the same epic)
  | 'decides' // adr -> concern|domain  (this decision governs that knowledge)
  | 'supersedes'; // adr -> adr        (this decision replaces/amends an earlier one)

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
