import { describe, it, expect } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../../src/build-graph.js';
import { parseKnowledge } from '../../src/readers/knowledge.js';
import type { Node } from '../../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, '../../__fixtures__/two-axis-sample');

describe('two-axis reader — EP44 fixture', () => {
  const graph = buildGraph(FIXTURE_ROOT);
  const idsOf = (type: Node['type']) => graph.nodesByType(type).map((n) => n.id).sort();

  it('builds story nodes from the archive timeline', () => {
    expect(idsOf('story')).toEqual(
      ['AGN05', 'EP44-RV01', 'EP44-ST01', 'EP44-ST02', 'EP44-ST03', 'EP44-ST05', 'EP44-ST06', 'EP44-ST07'].sort(),
    );
  });

  it('groups the domain axis by workspace unit, not by epic', () => {
    // Two KNOWLEDGE.md files exist in the fixture => two domain nodes.
    expect(idsOf('domain')).toEqual(['apps/srs-demo', 'packages/srs-engine-v2']);
  });

  it('treats the epic as an edge TARGET, never a grouping node', () => {
    const epic = graph.getNode('EP44');
    expect(epic?.type).toBe('epic');
    // No edge should ORIGINATE from an epic except the timeline `contains`.
    const nonContainsOut = graph.edges.filter(
      (e) => graph.getNode(e.from)?.type === 'epic' && e.type !== 'contains',
    );
    expect(nonContainsOut).toHaveLength(0);
    // The only edges leaving the epic are the timeline `contains` to its stories.
    const containsOut = graph.edges.filter((e) => e.from === 'EP44' && e.type === 'contains');
    expect(containsOut.length).toBeGreaterThan(0);
    // And the epic is pointed AT by domain provenance (`sources`).
    const inbound = graph.edges.filter((e) => e.to === 'EP44');
    expect(inbound.some((e) => e.type === 'sources')).toBe(true);
  });

  it('never mines file: component nodes (no git duplication)', () => {
    const fileNodes = Array.from(graph.nodes.values()).filter((n) => n.id.startsWith('file:'));
    expect(fileNodes).toHaveLength(0);
  });

  it('wires provenance at both grains: epic-level and story-level', () => {
    // apps/srs-demo --sources--> EP44 (epic-level)
    expect(
      graph.edges.some((e) => e.from === 'apps/srs-demo' && e.to === 'EP44' && e.type === 'sources'),
    ).toBe(true);
    // packages/srs-engine-v2 --sources--> EP44-RV01 (story-level)
    expect(
      graph.edges.some(
        (e) => e.from === 'packages/srs-engine-v2' && e.to === 'EP44-RV01' && e.type === 'sources',
      ),
    ).toBe(true);
  });

  it('wires the fixes cross-reference from the drive-by story', () => {
    expect(graph.edges.some((e) => e.from === 'EP44-RV01' && e.to === 'EP23' && e.type === 'fixes')).toBe(
      true,
    );
    // EP23 is materialized as an edge-target epic even without an included story.
    expect(graph.getNode('EP23')?.type).toBe('epic');
  });

  it('emits concern nodes from KNOWLEDGE.md headings, scoped to their domain', () => {
    const routing = graph.getNode('apps/srs-demo#Routing');
    expect(routing?.type).toBe('concern');
    expect(
      graph.edges.some((e) => e.from === 'apps/srs-demo#Routing' && e.to === 'apps/srs-demo' && e.type === 'about'),
    ).toBe(true);
  });

  it('applies the track filter', () => {
    const projectOnly = buildGraph(FIXTURE_ROOT, { tracks: ['project'] });
    expect(projectOnly.getNode('AGN05')).toBeUndefined();
    expect(projectOnly.getNode('EP44-ST01')).toBeDefined();
  });
});

describe('parseKnowledge', () => {
  it('parses frontmatter and level-2 headings', () => {
    const doc = parseKnowledge(
      ['---', 'unit: apps/srs-demo', 'sources: [EP44, EP44-RV01]', 'updated: 2026-07-19', '---', '', '# Title', '', '## Routing', 'body', '## App Shell', 'more'].join('\n'),
      '/x/KNOWLEDGE.md',
    );
    expect(doc?.frontmatter.unit).toBe('apps/srs-demo');
    expect(doc?.frontmatter.sources).toEqual(['EP44', 'EP44-RV01']);
    expect(doc?.concerns).toEqual(['Routing', 'App Shell']);
  });

  it('returns null when there is no unit frontmatter', () => {
    expect(parseKnowledge('# no frontmatter', '/x/KNOWLEDGE.md')).toBeNull();
  });
});
