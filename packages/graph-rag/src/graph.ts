import type { Node, Edge, NodeType, EdgeType, GraphData } from './types.js';

export class ProjectGraph {
  nodes: Map<string, Node> = new Map();
  edges: Edge[] = [];

  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: Edge): void {
    // Avoid duplicate edges
    const exists = this.edges.some((e) => e.from === edge.from && e.to === edge.to && e.type === edge.type);
    if (!exists) {
      this.edges.push(edge);
    }
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  nodesByType(type: NodeType): Node[] {
    return Array.from(this.nodes.values()).filter((n) => n.type === type);
  }

  // Traverse from a node following specific edge types
  traverse(nodeId: string, edgeTypes: EdgeType[], depth = 3): Node[] {
    const visited = new Set<string>();
    const results: Node[] = [];

    const walk = (id: string, d: number) => {
      if (d === 0 || visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node) results.push(node);

      const outgoing = this.edges.filter(
        (e) => e.from === id && edgeTypes.includes(e.type),
      );
      outgoing.forEach((e) => walk(e.to, d - 1));
    };

    walk(nodeId, depth);
    return results;
  }

  // Find paths between two nodes
  findPath(fromId: string, toId: string, maxDepth = 5): Edge[] {
    const paths: Edge[][] = [];

    const dfs = (current: string, target: string, visited: Set<string>, path: Edge[]) => {
      if (current === target) {
        paths.push([...path]);
        return;
      }
      if (path.length >= maxDepth) return;

      const outgoing = this.edges.filter((e) => e.from === current && !visited.has(e.to));
      outgoing.forEach((edge) => {
        visited.add(edge.to);
        path.push(edge);
        dfs(edge.to, target, visited, path);
        path.pop();
        visited.delete(edge.to);
      });
    };

    dfs(fromId, toId, new Set([fromId]), []);
    return paths.length > 0 ? paths[0] : [];
  }

  // Export to JSON for serialization
  toJSON(): GraphData {
    const nodesByType = this._countByType();

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      summary: {
        totalNodes: this.nodes.size,
        nodesByType,
        totalEdges: this.edges.length,
      },
    };
  }

  private _countByType(): Record<NodeType, number> {
    const counts: Record<NodeType, number> = {
      domain: 0,
      concern: 0,
    };

    this.nodes.forEach((node) => {
      counts[node.type]++;
    });

    return counts;
  }
}
