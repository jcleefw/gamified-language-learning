import { describe, it, expect } from 'vitest';
import { ProjectGraph } from '../../src/graph.js';

describe('ProjectGraph', () => {
  it('should add and retrieve nodes', () => {
    const graph = new ProjectGraph();

    graph.addNode({
      id: 'apps/srs-demo',
      type: 'domain',
      label: 'apps/srs-demo',
      metadata: { unit: 'apps/srs-demo' },
    });

    const node = graph.getNode('apps/srs-demo');
    expect(node).toBeDefined();
    expect(node?.type).toBe('domain');
  });

  it('should add and retrieve edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'apps/srs-demo', type: 'domain', label: 'apps/srs-demo', metadata: {} });
    graph.addNode({ id: 'apps/srs-demo#Routing', type: 'concern', label: 'Routing', metadata: {} });

    graph.addEdge({
      from: 'apps/srs-demo',
      to: 'apps/srs-demo#Routing',
      type: 'contains',
      label: 'contains',
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe('apps/srs-demo');
  });

  it('should not add duplicate edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'A', type: 'concern', label: 'A', metadata: {} });
    graph.addNode({ id: 'B', type: 'concern', label: 'B', metadata: {} });

    graph.addEdge({ from: 'A', to: 'B', type: 'relates', label: 'relates' });
    graph.addEdge({ from: 'A', to: 'B', type: 'relates', label: 'relates' });

    expect(graph.edges).toHaveLength(1);
  });

  it('should filter nodes by type', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'apps/srs-demo', type: 'domain', label: 'srs-demo', metadata: {} });
    graph.addNode({ id: 'apps/srs-demo#Routing', type: 'concern', label: 'Routing', metadata: {} });
    graph.addNode({ id: 'apps/srs-demo#App Shell', type: 'concern', label: 'App Shell', metadata: {} });

    expect(graph.nodesByType('domain')).toHaveLength(1);
    expect(graph.nodesByType('concern')).toHaveLength(2);
  });

  it('should export to JSON', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'apps/srs-demo', type: 'domain', label: 'srs-demo', metadata: {} });
    graph.addNode({ id: 'apps/srs-demo#Routing', type: 'concern', label: 'Routing', metadata: {} });
    graph.addEdge({ from: 'apps/srs-demo', to: 'apps/srs-demo#Routing', type: 'contains', label: 'contains' });

    const json = graph.toJSON();

    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toHaveLength(1);
    expect(json.summary.totalNodes).toBe(2);
    expect(json.summary.nodesByType.domain).toBe(1);
    expect(json.summary.nodesByType.concern).toBe(1);
  });
});
