import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildGraph } from '../../src/build-graph.js';
import type { ProjectGraph } from '../../src/graph.js';
import { parseKnowledge } from '../../src/readers/knowledge.js';
import { buildProvenanceIndex, ryoikiKey } from '../../src/readers/archive.js';
import type { Node } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Builds a minimal fixture tree in a temp directory (no more __fixtures__/
// on disk — the package must never be buildable against anything but the
// real repo root, so test data is created and torn down inline instead).
// Two domains (apps/srs-demo, packages/srs-engine-v2), cross-domain
// provenance via one epic, one aliased ryoiki (nav -> routing), and one
// blacklisted heading per domain (unit-scoped and global).
// ---------------------------------------------------------------------------

function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'graph-rag-ryoiki-'));

  const archiveDir = join(root, '.agents/changelogs/archive');
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(
    join(archiveDir, 'index.json'),
    JSON.stringify({
      stories: [
        { id: 'EP44-ST01', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'routing', completed: '2026-07-15', summary: 's', pr: 41 },
        { id: 'EP44-ST02', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'routing', completed: '2026-07-15', summary: 's', pr: 41 },
        { id: 'EP44-ST03', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'routing', completed: '2026-07-16', summary: 's', pr: 41 },
        { id: 'EP44-ST05', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'nav', completed: '2026-07-16', summary: 's', pr: 41 },
        { id: 'EP44-ST06', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'app-shell', completed: '2026-07-16', summary: 's', pr: 41 },
        { id: 'EP44-ST07', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'app-shell', completed: '2026-07-16', summary: 's', pr: 41 },
        { id: 'EP44-RV01', epic: 'EP44', track: 'project', title: 't', domain: 'packages/srs-engine-v2', ryoiki: 'batch-composition', completed: '2026-07-16', summary: 's', pr: 41 },
        { id: 'AGN05', epic: 'AGN05', track: 'agentic', title: 't', domain: 'agentic/knowledge', ryoiki: 'archive-structure', completed: '2026-07-18', summary: 's', pr: null },
      ],
      epics: {
        EP44: { title: 'App.vue to Vue Router refactor', domains: ['apps/srs-demo', 'packages/srs-engine-v2'], archived: '2026-07-19' },
      },
    }),
  );

  const referenceDir = join(root, '.agents/reference');
  mkdirSync(referenceDir, { recursive: true });
  writeFileSync(
    join(referenceDir, 'ryoiki-aliases.json'),
    JSON.stringify({
      routing: { description: 'Client-side navigation and the route table.', alias: ['nav', 'navigation', 'vue-router'] },
      'workspace-tooling': { description: 'Lint / format / build configuration.', alias: ['linting', 'build-tooling'] },
    }),
  );
  writeFileSync(
    join(referenceDir, 'ryoiki-blacklist.json'),
    JSON.stringify({ '*': ['type-definitions'], 'apps/srs-demo': ['workspace-tooling'] }),
  );

  const srsDemoDir = join(root, 'apps/srs-demo');
  mkdirSync(srsDemoDir, { recursive: true });
  writeFileSync(
    join(srsDemoDir, 'KNOWLEDGE.md'),
    [
      '---',
      'unit: apps/srs-demo',
      'sources: [EP44]',
      'updated: 2026-07-19',
      '---',
      '',
      '# srs-demo — Domain Knowledge',
      '',
      '## Routing',
      '',
      '- Navigation is handled by Vue Router 4.',
      '',
      '## App Shell',
      '',
      '- `App.vue` is a layout shell.',
      '',
      '## Workspace Tooling',
      '',
      '- ANOMALY FIXTURE: this ryoiki is blacklisted for apps/srs-demo, so it should',
      '  never have been written here.',
      '',
    ].join('\n'),
  );

  const srsEngineDir = join(root, 'packages/srs-engine-v2');
  mkdirSync(srsEngineDir, { recursive: true });
  writeFileSync(
    join(srsEngineDir, 'KNOWLEDGE.md'),
    [
      '---',
      'unit: packages/srs-engine-v2',
      'sources: [EP44-RV01]',
      'updated: 2026-07-19',
      '---',
      '',
      '# srs-engine-v2 — Domain Knowledge',
      '',
      '## Batch Composition',
      '',
      '- Batch assembly randomizes item order with an unbiased Fisher-Yates shuffle.',
      '',
      '## Type Definitions',
      '',
      '- ANOMALY FIXTURE: this ryoiki is blacklisted globally (the "*" key), so it',
      '  should never have been written here.',
      '',
    ].join('\n'),
  );

  return root;
}

describe('ryoiki-centric reader — fixture', () => {
  let fixtureRoot: string;
  let graph: ProjectGraph;
  let warnings: string[];

  beforeAll(() => {
    fixtureRoot = buildFixture();
    // The fixture deliberately contains two blacklisted headings (an authoring
    // anomaly). Capture the warnings the reader emits about them instead of
    // spamming the test console.
    warnings = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      warnings.push(args.join(' '));
    });
    graph = buildGraph(fixtureRoot);
    warn.mockRestore();
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  const idsOf = (type: Node['type']): string[] => graph.nodesByType(type).map((n) => n.id).sort();

  it('portrays knowledge, not work: NO story or epic nodes exist', () => {
    // The graph is domains + ryoiki (knowledge) + kettei (decisions) — never work.
    const types = new Set(Array.from(graph.nodes.values()).map((n) => n.type));
    expect(types.has('story' as Node['type'])).toBe(false);
    expect(types.has('epic' as Node['type'])).toBe(false);
    expect([...types].sort()).toEqual(['domain', 'ryoiki']);
  });

  it('groups ryoiki under their workspace-unit domain', () => {
    expect(idsOf('domain')).toEqual(['apps/srs-demo', 'packages/srs-engine-v2']);
    expect(idsOf('ryoiki')).toEqual(
      ['apps/srs-demo#App Shell', 'apps/srs-demo#Routing', 'packages/srs-engine-v2#Batch Composition'].sort(),
    );
    // domain --contains--> ryoiki
    expect(
      graph.edges.some(
        (e) => e.from === 'apps/srs-demo' && e.to === 'apps/srs-demo#Routing' && e.type === 'contains',
      ),
    ).toBe(true);
  });

  it('warns about and excludes a blacklisted heading wrongly written to KNOWLEDGE.md', () => {
    // Blacklisted ryoiki must never enter the graph, and — since they should
    // never have been written as headings — their presence is surfaced loudly.
    expect(graph.getNode('apps/srs-demo#Workspace Tooling')).toBeUndefined(); // unit blacklist
    expect(graph.getNode('packages/srs-engine-v2#Type Definitions')).toBeUndefined(); // global "*"
    expect(warnings.some((m) => m.includes('Workspace Tooling'))).toBe(true);
    expect(warnings.some((m) => m.includes('Type Definitions'))).toBe(true);
  });

  it('keeps the producing work as ryoiki PROVENANCE metadata, not nodes', () => {
    const routing = graph.getNode('apps/srs-demo#Routing');
    expect(routing?.type).toBe('ryoiki');
    // One story is tagged `nav` in the archive; the alias map folds it to
    // `routing`, so it still lands on the Routing heading alongside the direct hits.
    expect(routing?.metadata.sources).toEqual(['EP44-ST01', 'EP44-ST02', 'EP44-ST03', 'EP44-ST05']);
    expect(routing?.metadata.epics).toEqual(['EP44']);
    expect(routing?.metadata.prs).toEqual([41]);
    // 'App Shell' collides case/hyphen-insensitively with story ryoiki 'app-shell'.
    const shell = graph.getNode('apps/srs-demo#App Shell');
    expect(shell?.metadata.sources).toEqual(['EP44-ST06', 'EP44-ST07']);
  });

  it('carries the KNOWLEDGE.md prose beneath each heading as the ryoiki content', () => {
    const batch = graph.getNode('packages/srs-engine-v2#Batch Composition');
    expect(String(batch?.metadata.content)).toContain('Fisher-Yates');
  });

  it('draws cross-domain `relates` edges for ryoiki co-produced by one epic', () => {
    // One epic spanned apps/srs-demo and packages/srs-engine-v2, so their ryoiki relate.
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

  it('does NOT relate ryoiki within the same domain (already grouped by domain)', () => {
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
    // The agentic-track story has no KNOWLEDGE.md, so it never was a ryoiki;
    // filtering still must not throw and project ryoiki keep their provenance.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const projectOnly = buildGraph(fixtureRoot, { tracks: ['project'] });
    warn.mockRestore();
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
      { id: 'EP44-ST01', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'routing', completed: '', summary: '', pr: 41 },
      { id: 'EP44-ST06', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'app-shell', completed: '', summary: '', pr: 41 },
      { id: 'AGN05', epic: 'AGN05', track: 'agentic', title: 't', domain: 'agentic/knowledge', ryoiki: 'archive-structure', completed: '', summary: '', pr: null },
    ],
    epics: {},
  };

  it('keys provenance by (domain, normalized ryoiki) and dedupes epics/prs', () => {
    const idx = buildProvenanceIndex(archive);
    const routing = idx.byRyoiki.get(ryoikiKey('apps/srs-demo', 'Routing'));
    expect(routing?.stories).toEqual(['EP44-ST01']);
    expect(routing?.epics).toEqual(['EP44']);
    expect(routing?.prs).toEqual([41]);
  });

  it('folds a drift variant to its canonical ryoiki via `canonicalize`', () => {
    // A story tagged `nav` must key under the canonical `routing`.
    const canonicalize = (name: string): string => (name === 'nav' ? 'routing' : name);
    const withVariant = {
      ...archive,
      stories: [
        ...archive.stories,
        { id: 'EP44-ST05', epic: 'EP44', track: 'project', title: 't', domain: 'apps/srs-demo', ryoiki: 'nav', completed: '', summary: '', pr: 41 },
      ],
    };
    const idx = buildProvenanceIndex(withVariant, {}, canonicalize);
    expect(idx.byRyoiki.get(ryoikiKey('apps/srs-demo', 'routing'))?.stories).toEqual(['EP44-ST01', 'EP44-ST05']);
  });

  it('records which ryoiki each epic spans (for relates)', () => {
    const idx = buildProvenanceIndex(archive);
    expect(idx.epicSpan.get('EP44')?.size).toBe(2);
  });

  it('honors the track filter', () => {
    const idx = buildProvenanceIndex(archive, { tracks: ['project'] });
    expect(idx.byRyoiki.has(ryoikiKey('agentic/knowledge', 'archive-structure'))).toBe(false);
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
    expect(doc?.ryoiki.map((c) => c.title)).toEqual(['Routing', 'App Shell']);
    expect(doc?.ryoiki[0].content).toBe('route body');
    expect(doc?.ryoiki[1].content).toBe('shell body');
  });

  it('returns null when there is no unit frontmatter', () => {
    expect(parseKnowledge('# no frontmatter', '/x/KNOWLEDGE.md')).toBeNull();
  });
});
