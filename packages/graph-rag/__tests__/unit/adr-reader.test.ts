import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildGraph } from '../../src/build-graph.js';
import { parseAdr, adrSlug, findAdrFiles } from '../../src/readers/adr.js';

// ---------------------------------------------------------------------------
// Builds a minimal fixture tree in a temp directory (no more __fixtures__/
// on disk — the package must never be buildable against anything but the
// real repo root, so test data is created and torn down inline instead).
// ---------------------------------------------------------------------------

function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'graph-rag-adr-'));
  const adrDir = join(root, 'product-documentation/architecture');
  mkdirSync(adrDir, { recursive: true });

  // loadArchiveIndex() requires this file to exist; an empty archive is fine
  // since this fixture only exercises the ADR reader.
  const archiveDir = join(root, '.agents/changelogs/archive');
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(join(archiveDir, 'index.json'), JSON.stringify({ stories: [], epics: {} }));

  writeFileSync(
    join(adrDir, '20260701T100000Z-engineering-screen-string-routing.md'),
    [
      '# ADR: Screen-string routing',
      '',
      '**Status:** Superseded by [Routing via Vue Router 4](20260714T100000Z-engineering-routing-vue-router.md) (2026-07-14).',
      '',
      '**Date:** 2026-07-01',
      '',
      '**Deciders:** PO (solo founder)',
      '',
      '**Scope:** The original navigation approach for srs-demo.',
      '',
      '---',
      '',
      '## Context',
      '',
      'The app began with a single reactive `screen` string switched in App.vue. This',
      'ADR records that original decision; it has since been replaced.',
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(adrDir, '20260714T100000Z-engineering-routing-vue-router.md'),
    [
      '# ADR: Routing via Vue Router 4',
      '',
      '**Status:** Accepted',
      '',
      '**Date:** 2026-07-14',
      '',
      '**Deciders:** PO (solo founder)',
      '',
      '**Scope:** How the srs-demo app navigates between screens.',
      '',
      '**Decides:** apps/srs-demo#Routing',
      '',
      '---',
      '',
      '## Context',
      '',
      'Screen-string routing had grown unwieldy as the number of screens increased.',
      '',
      '## Decision',
      '',
      'Adopt Vue Router 4 with lazy-loaded routes, one per screen, and a nav guard for',
      'the confirm/flush/finalize sequence.',
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(adrDir, '20260715T100000Z-engineering-audio-playback.md'),
    [
      '# ADR: Conversation audio playback',
      '',
      '**Status:** Proposed',
      '',
      '**Date:** 2026-07-15',
      '',
      '**Deciders:** PO (solo founder)',
      '',
      '**Scope:** How pronunciation audio is consumed at runtime.',
      '',
      '**Decides:** apps/srs-demo#Audio Playback',
      '',
      '---',
      '',
      '## Context',
      '',
      'Audio is an MVP-release blocker. This decision names a ryoiki (`Audio Playback`)',
      'that has not been built yet — so the ADR stays FLOATING until that ryoiki exists.',
      '',
    ].join('\n'),
  );

  // A single ryoiki node (apps/srs-demo#Routing) for the `decides` edge to land on.
  const unitDir = join(root, 'apps/srs-demo');
  mkdirSync(unitDir, { recursive: true });
  writeFileSync(
    join(unitDir, 'KNOWLEDGE.md'),
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
    ].join('\n'),
  );

  return root;
}

describe('adrSlug', () => {
  it('strips the timestamp prefix and .md suffix', () => {
    expect(adrSlug('20260714T100000Z-engineering-routing-vue-router.md')).toBe(
      'engineering-routing-vue-router',
    );
  });
});

describe('parseAdr', () => {
  it('reads the bold fields, the Decides targets, and the body as content', () => {
    const doc = parseAdr(
      [
        '# ADR: Routing via Vue Router 4',
        '',
        '**Status:** Accepted',
        '**Date:** 2026-07-14',
        '**Deciders:** PO (solo founder)',
        '**Scope:** How the app navigates.',
        '**Decides:** apps/srs-demo#Routing, packages/srs-engine-v2',
        '',
        '---',
        '',
        '## Context',
        'body prose',
      ].join('\n'),
      '/x/20260714T100000Z-engineering-routing-vue-router.md',
    );
    expect(doc?.slug).toBe('engineering-routing-vue-router');
    expect(doc?.title).toBe('ADR: Routing via Vue Router 4');
    expect(doc?.status).toBe('Accepted');
    expect(doc?.date).toBe('2026-07-14');
    expect(doc?.decides).toEqual(['apps/srs-demo#Routing', 'packages/srs-engine-v2']);
    expect(doc?.content).toContain('body prose');
  });

  it('takes only the first token of a compound Status line', () => {
    const doc = parseAdr(
      ['# ADR', '**Status:** Accepted (amended) — see below', '', '---', 'x'].join('\n'),
      '/x/20260101T000000Z-engineering-x.md',
    );
    expect(doc?.status).toBe('Accepted');
  });

  it('returns null when there is no Status line (not an ADR)', () => {
    expect(parseAdr('# Just a note\n\nsome text', '/x/notes.md')).toBeNull();
  });

  it('parses kettei->kettei lineage from a "Superseded by" link (newer supersedes this)', () => {
    const doc = parseAdr(
      [
        '# ADR: Old approach',
        '**Status:** Superseded by [New](20260714T100000Z-engineering-new.md) (2026-07-14).',
        '',
        '---',
        'context',
      ].join('\n'),
      '/x/20260701T100000Z-engineering-old.md',
    );
    expect(doc?.lineage).toEqual([
      { supersederSlug: 'engineering-new', supersededSlug: 'engineering-old' },
    ]);
  });
});

describe('ingestAdrs — against a fixture', () => {
  let fixtureRoot: string;
  let graph: ReturnType<typeof buildGraph>;

  beforeAll(() => {
    fixtureRoot = buildFixture();
    graph = buildGraph(fixtureRoot);
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('finds the fixture ADR files', () => {
    expect(findAdrFiles(fixtureRoot).length).toBe(3);
  });

  it('adds a kettei node per ADR', () => {
    const adrs = graph.nodesByType('kettei').map((n) => n.id).sort();
    expect(adrs).toEqual([
      'kettei:engineering-audio-playback',
      'kettei:engineering-routing-vue-router',
      'kettei:engineering-screen-string-routing',
    ]);
  });

  it('draws a `decides` edge to a ryoiki whose node exists', () => {
    expect(
      graph.edges.some(
        (e) =>
          e.from === 'kettei:engineering-routing-vue-router' &&
          e.to === 'apps/srs-demo#Routing' &&
          e.type === 'decides',
      ),
    ).toBe(true);
  });

  it('leaves an ADR FLOATING when its Decides target has no matching ryoiki', () => {
    // engineering-audio-playback decides `apps/srs-demo#Audio Playback` (not built).
    const decides = graph.edges.filter(
      (e) => e.from === 'kettei:engineering-audio-playback' && e.type === 'decides',
    );
    expect(decides).toHaveLength(0);
  });

  it('leaves an ADR FLOATING when it has no Decides field at all', () => {
    const decides = graph.edges.filter(
      (e) => e.from === 'kettei:engineering-screen-string-routing' && e.type === 'decides',
    );
    expect(decides).toHaveLength(0);
  });

  it('wires a `supersedes` edge between ADRs (newer -> older)', () => {
    expect(
      graph.edges.some(
        (e) =>
          e.from === 'kettei:engineering-routing-vue-router' &&
          e.to === 'kettei:engineering-screen-string-routing' &&
          e.type === 'supersedes',
      ),
    ).toBe(true);
  });
});
