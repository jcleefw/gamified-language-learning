import { describe, it, expect } from 'vitest';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildGraph } from '../../src/build-graph.js';
import { parseAdr, adrSlug, findAdrFiles } from '../../src/readers/adr.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, '../../__fixtures__/two-axis-sample');

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

  it('parses adr->adr lineage from a "Superseded by" link (newer supersedes this)', () => {
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

describe('ingestAdrs — against the fixture', () => {
  const graph = buildGraph(FIXTURE_ROOT);

  it('finds the fixture ADR files', () => {
    expect(findAdrFiles(FIXTURE_ROOT).length).toBe(3);
  });

  it('adds an adr node per ADR', () => {
    const adrs = graph.nodesByType('adr').map((n) => n.id).sort();
    expect(adrs).toEqual([
      'adr:engineering-audio-playback',
      'adr:engineering-routing-vue-router',
      'adr:engineering-screen-string-routing',
    ]);
  });

  it('draws a `decides` edge to a ryoiki whose node exists', () => {
    expect(
      graph.edges.some(
        (e) =>
          e.from === 'adr:engineering-routing-vue-router' &&
          e.to === 'apps/srs-demo#Routing' &&
          e.type === 'decides',
      ),
    ).toBe(true);
  });

  it('leaves an ADR FLOATING when its Decides target has no matching ryoiki', () => {
    // engineering-audio-playback decides `apps/srs-demo#Audio Playback` (not built).
    const decides = graph.edges.filter(
      (e) => e.from === 'adr:engineering-audio-playback' && e.type === 'decides',
    );
    expect(decides).toHaveLength(0);
  });

  it('leaves an ADR FLOATING when it has no Decides field at all', () => {
    const decides = graph.edges.filter(
      (e) => e.from === 'adr:engineering-screen-string-routing' && e.type === 'decides',
    );
    expect(decides).toHaveLength(0);
  });

  it('wires a `supersedes` edge between ADRs (newer -> older)', () => {
    expect(
      graph.edges.some(
        (e) =>
          e.from === 'adr:engineering-routing-vue-router' &&
          e.to === 'adr:engineering-screen-string-routing' &&
          e.type === 'supersedes',
      ),
    ).toBe(true);
  });
});
