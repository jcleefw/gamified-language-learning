import { describe, it, expect } from 'vitest';
import { ProjectGraph } from '../../src/graph.js';

describe('ProjectGraph', () => {
  it('should add and retrieve nodes', () => {
    const graph = new ProjectGraph();

    graph.addNode({
      id: 'EP01',
      type: 'episode',
      label: 'EP01: Monorepo Scaffolding',
      metadata: { problem: 'No project structure' },
    });

    const node = graph.getNode('EP01');
    expect(node).toBeDefined();
    expect(node?.label).toBe('EP01: Monorepo Scaffolding');
  });

  it('should add and retrieve edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({
      id: 'EP01',
      type: 'episode',
      label: 'EP01',
      metadata: {},
    });

    graph.addNode({
      id: 'EP02',
      type: 'episode',
      label: 'EP02',
      metadata: {},
    });

    graph.addEdge({
      from: 'EP02',
      to: 'EP01',
      type: 'depends-on',
      label: 'depends on',
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe('EP02');
  });

  it('should not add duplicate edges', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'A', type: 'episode', label: 'A', metadata: {} });
    graph.addNode({ id: 'B', type: 'episode', label: 'B', metadata: {} });

    graph.addEdge({
      from: 'A',
      to: 'B',
      type: 'depends-on',
      label: 'depends on',
    });

    graph.addEdge({
      from: 'A',
      to: 'B',
      type: 'depends-on',
      label: 'depends on',
    });

    expect(graph.edges).toHaveLength(1);
  });

  it('should filter nodes by type', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'EP01', type: 'episode', label: 'EP01', metadata: {} });
    graph.addNode({ id: 'EP01-ST01', type: 'story', label: 'ST01', metadata: {} });
    graph.addNode({ id: 'DS01', type: 'design-spec', label: 'DS01', metadata: {} });

    const episodes = graph.nodesByType('episode');
    const stories = graph.nodesByType('story');

    expect(episodes).toHaveLength(1);
    expect(stories).toHaveLength(1);
  });

  it('should export to JSON', () => {
    const graph = new ProjectGraph();

    graph.addNode({ id: 'EP01', type: 'episode', label: 'EP01', metadata: {} });
    graph.addEdge({
      from: 'EP01',
      to: 'EP02',
      type: 'depends-on',
      label: 'depends on',
    });

    const json = graph.toJSON();

    expect(json.nodes).toHaveLength(1);
    expect(json.edges).toHaveLength(1);
    expect(json.summary.totalNodes).toBe(1);
    expect(json.summary.totalEdges).toBe(1);
  });
});
