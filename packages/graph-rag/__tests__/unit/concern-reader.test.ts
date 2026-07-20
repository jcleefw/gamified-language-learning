import { describe, it, expect } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../../src/build-graph.js';
import { parseKnowledge } from '../../src/readers/knowledge.js';
import { buildProvenanceIndex, concernKey } from '../../src/readers/archive.js';
import type { Node } from '../../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, '../../__fixtures__/two-axis-sample');

describe('concern-centric reader — EP44 fixture', () => {
  const graph = buildGraph(FIXTURE_ROOT);
  const idsOf = (type: Node['type']) => graph.nodesByType(type).map((n) => n.id).sort();

  it('portrays knowledge, not work: NO story or epic nodes exist', () => {
    // The graph is domains + concerns (knowledge) + adrs (decisions) — never work.
    const types = new Set(Array.from(graph.nodes.values()).map((n) => n.type));
    expect(types.has('story' as Node['type'])).toBe(false);
    expect(types.has('epic' as Node['type'])).toBe(false);
    expect([...types].sort()).toEqual(['adr', 'concern', 'domain']);
  });

  it('groups concerns under their workspace-unit domain', () => {
    expect(idsOf('domain')).toEqual(['apps/srs-demo', 'packages/srs-engine-v2']);
    expect(idsOf('concern')).toEqual(
      ['apps/srs-demo#App Shell', 'apps/srs-demo#Routing', 'packages/srs-engine-v2#Batch Composition'].sort(),
    );
    // domain --contains--> concern
    expect(
      graph.edges.some(
        (e) => e.from === 'apps/srs-demo' && e.to === 'apps/srs-demo#Routing' && e.type === 'contains',
      ),
    ).toBe(true);
  });

  it('keeps the producing work as concern PROVENANCE metadata, not nodes', () => {
    const routing = graph.getNode('apps/srs-demo#Routing');
    expect(routing?.type).toBe('concern');
    expect(routing?.metadata.sources).toEqual(['EP44-ST01', 'EP44-ST02', 'EP44-ST03', 'EP44-ST05']);
    expect(routing?.metadata.epics).toEqual(['EP44']);
    expect(routing?.metadata.prs).toEqual([41]);
    // 'App Shell' collides case/hyphen-insensitively with story concern 'app-shell'.
    const shell = graph.getNode('apps/srs-demo#App Shell');
    expect(shell?.metadata.sources).toEqual(['EP44-ST06', 'EP44-ST07']);
  });

  it('carries the KNOWLEDGE.md prose beneath each heading as the concern content', () => {
    const batch = graph.getNode('packages/srs-engine-v2#Batch Composition');
    expect(String(batch?.metadata.content)).toContain('Fisher-Yates');
  });

  it('draws cross-domain `relates` edges for concerns co-produced by one epic', () => {
    // EP44 spanned apps/srs-demo and packages/srs-engine-v2, so their concerns relate.
    const relates = graph.edges.filter((e) => e.type === 'relates');
    expect(relates.length).toBe(2);
    expect(relates.every((e) => e.label === 'via EP44')).toBe(true);
    const endpoints = relates.map((e) => [e.from, e.to].sort().join(' | ')).sort();
    expect(endpoints).toEqual(
      [
        ['apps/srs-demo#Routing', 'packages/srs-engine-v2#Batch Composition'].sort().join(' | '),
        ['apps/srs-demo#App Shell', 'packages/srs-engine-v2#Batch Composition'].sort().join(' | '),
      ].sort(),
    );
  });

  it('does NOT relate concerns within the same domain (already grouped by domain)', () => {
    const intra = graph.edges.filter(
      (e) =>
        e.type === 'relates' &&
        e.from.startsWith('apps/srs-demo#') &&
        e.to.startsWith('apps/srs-demo#'),
    );
    expect(intra).toHaveLength(0);
  });

  it('never mines file: nodes (no git duplication)', () => {
    expect(Array.from(graph.nodes.values()).filter((n) => n.id.startsWith('file:'))).toHaveLength(0);
  });

  it('applies the track filter to provenance (agentic story drops out)', () => {
    // AGN05 (agentic) has no KNOWLEDGE.md, so it never was a concern; filtering
    // still must not throw and project concerns keep their provenance.
    const projectOnly = buildGraph(FIXTURE_ROOT, { tracks: ['project'] });
    expect(projectOnly.getNode('apps/srs-demo#Routing')?.metadata.sources).toEqual([
      'EP44-ST01',
      'EP44-ST02',
      'EP44-ST03',
      'EP44-ST05',
    ]);
  });
});

describe('buildProvenanceIndex', () => {
  const archive = {
    stories: [
      { id: 'EP44-ST01', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', concern: 'routing', completed: '', summary: '', pr: 41 },
      { id: 'EP44-ST06', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', concern: 'app-shell', completed: '', summary: '', pr: 41 },
      { id: 'AGN05', epic: 'AGN05', track: 'agentic', title: 't', domain: 'agentic/knowledge', concern: 'archive-structure', completed: '', summary: '', pr: null },
    ],
    epics: {},
  };

  it('keys provenance by (domain, normalized concern) and dedupes epics/prs', () => {
    const idx = buildProvenanceIndex(archive);
    const routing = idx.byConcern.get(concernKey('apps/srs-demo', 'Routing'));
    expect(routing?.stories).toEqual(['EP44-ST01']);
    expect(routing?.epics).toEqual(['EP44']);
    expect(routing?.prs).toEqual([41]);
  });

  it('records which concerns each epic spans (for relates)', () => {
    const idx = buildProvenanceIndex(archive);
    expect(idx.epicSpan.get('EP44')?.size).toBe(2);
  });

  it('honors the track filter', () => {
    const idx = buildProvenanceIndex(archive, { tracks: ['project'] });
    expect(idx.byConcern.has(concernKey('agentic/knowledge', 'archive-structure'))).toBe(false);
  });
});

describe('parseKnowledge', () => {
  it('parses frontmatter and captures the prose under each heading', () => {
    const doc = parseKnowledge(
      ['---', 'unit: apps/srs-demo', 'sources: [EP44]', 'updated: 2026-07-19', '---', '', '# Title', '', '## Routing', 'route body', '', '## App Shell', 'shell body'].join('\n'),
      '/x/KNOWLEDGE.md',
    );
    expect(doc?.frontmatter.unit).toBe('apps/srs-demo');
    expect(doc?.frontmatter.sources).toEqual(['EP44']);
    expect(doc?.concerns.map((c) => c.title)).toEqual(['Routing', 'App Shell']);
    expect(doc?.concerns[0].content).toBe('route body');
    expect(doc?.concerns[1].content).toBe('shell body');
  });

  it('returns null when there is no unit frontmatter', () => {
    expect(parseKnowledge('# no frontmatter', '/x/KNOWLEDGE.md')).toBeNull();
  });
});
