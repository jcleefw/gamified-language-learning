// ============================================================================
// Types for Graph RAG
// ============================================================================

export type NodeType = 'episode' | 'story' | 'design-spec' | 'problem' | 'component' | 'decision';

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, unknown>;
}

export type EdgeType =
  | 'contains'
  | 'depends-on'
  | 'solves'
  | 'documents'
  | 'implements'
  | 'defines'
  | 'modified'
  | 'references'
  | 'evolved-to'
  | 'corrected-from';

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
  context: string;
  nodes: Node[];
  edges: Edge[];
}
