import { describe, it, expect } from 'vitest';
import { ProjectGraph } from '../../src/graph.js';

describe('ProjectGraph', () => {
  it('should add and retrieve nodes', () => {
    const graph = new ProjectGraph();

    graph.addNode({
      id: 'EP44',
      type: 'epic',
      label: 'EP44: App.vue to Vue Router refactor',
      metadata: { title: 'App.vue to Vue Router refactor' },
    });

    const node = graph.getNode('EP44');
    expect(node).toBeDefined();
    expect(node?.label).toBe('EP44: App.vue to Vue Router refactor');
  });

  it('should add and retrieve edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'EP44', type: 'epic', label: 'EP44', metadata: {} });
    graph.addNode({ id: 'EP44-ST01', type: 'story', label: 'EP44-ST01', metadata: {} });

    graph.addEdge({
      from: 'EP44',
      to: 'EP44-ST01',
      type: 'contains',
      label: 'contains story',
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe('EP44');
  });

  it('should not add duplicate edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'A', type: 'story', label: 'A', metadata: {} });
    graph.addNode({ id: 'B', type: 'domain', label: 'B', metadata: {} });

    graph.addEdge({ from: 'A', to: 'B', type: 'touches', label: 'touches' });
    graph.addEdge({ from: 'A', to: 'B', type: 'touches', label: 'touches' });

    expect(graph.edges).toHaveLength(1);
  });

  it('should filter nodes by type', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'EP44', type: 'epic', label: 'EP44', metadata: {} });
    graph.addNode({ id: 'EP44-ST01', type: 'story', label: 'ST01', metadata: {} });
    graph.addNode({ id: 'apps/srs-demo', type: 'domain', label: 'srs-demo', metadata: {} });

    expect(graph.nodesByType('epic')).toHaveLength(1);
    expect(graph.nodesByType('story')).toHaveLength(1);
    expect(graph.nodesByType('domain')).toHaveLength(1);
  });

  it('should export to JSON', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'EP44', type: 'epic', label: 'EP44', metadata: {} });
    graph.addNode({ id: 'EP44-ST01', type: 'story', label: 'ST01', metadata: {} });
    graph.addEdge({ from: 'EP44', to: 'EP44-ST01', type: 'contains', label: 'contains' });

    const json = graph.toJSON();

    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toHaveLength(1);
    expect(json.summary.totalNodes).toBe(2);
    expect(json.summary.totalEdges).toBe(1);
    expect(json.summary.nodesByType.epic).toBe(1);
    expect(json.summary.nodesByType.story).toBe(1);
  });
});
