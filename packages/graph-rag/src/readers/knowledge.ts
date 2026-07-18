import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from '../graph.js';

// ---------------------------------------------------------------------------
// Domain axis reader: {apps,packages,...}/<unit>/KNOWLEDGE.md
//
// Produces `domain` and `concern` nodes:
//   concern --about--> domain               (level-2 heading scoping)
//   domain  --sources--> story|epic         (frontmatter `sources` = provenance)
//
// The `sources` edge is the mechanism that keeps the epic an edge TARGET: a
// KNOWLEDGE.md points back at the epics/stories that produced its state; the
// graph is never grouped by epic.
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', '.agents', 'dist', 'coverage', '__fixtures__']);

export interface KnowledgeFrontmatter {
  unit: string;
  sources: string[];
  updated?: string;
  concern?: string;
}

export interface KnowledgeDoc {
  frontmatter: KnowledgeFrontmatter;
  concerns: string[]; // level-2 headings, in document order
  path: string; // absolute path on disk (provenance only; NOT the node identity)
}

export interface KnowledgeFilter {
  domains?: string[] | null;
}

/** Recursively find every KNOWLEDGE.md below `root`, skipping vendored/agent dirs. */
export function findKnowledgeFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries: import('fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name === 'KNOWLEDGE.md') {
        found.push(join(dir, entry.name));
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Minimal frontmatter parser for the fixed KNOWLEDGE.md shape (D5):
 *   unit: <scalar>, sources: [<id>, ...], updated: <scalar>, concern: <scalar>.
 * Deliberately not a full YAML parser — the frontmatter shape is fixed by the ADR.
 */
export function parseKnowledge(content: string, path: string): KnowledgeDoc | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return null;
  const [, fmBlock, body] = fmMatch;

  const fm: Record<string, string> = {};
  for (const line of fmBlock.split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }

  if (!fm.unit) return null;

  const parseList = (raw: string | undefined): string[] => {
    if (!raw) return [];
    const inner = raw.replace(/^\[/, '').replace(/\]$/, '');
    return inner
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  };

  const concerns = Array.from(body.matchAll(/^##\s+(.+?)\s*$/gm)).map((m) => m[1].trim());

  return {
    frontmatter: {
      unit: fm.unit.replace(/^["']|["']$/g, ''),
      sources: parseList(fm.sources),
      updated: fm.updated,
      concern: fm.concern,
    },
    concerns,
    path,
  };
}

/**
 * Read every KNOWLEDGE.md below `root` into the graph as domain/concern nodes,
 * wiring `about` and `sources` edges. `sources` edges are only created to nodes
 * that already exist in the graph (the archive reader runs first).
 */
export function ingestKnowledge(
  graph: ProjectGraph,
  root: string,
  filter: KnowledgeFilter = {},
): void {
  for (const file of findKnowledgeFiles(root)) {
    const doc = parseKnowledge(readFileSync(file, 'utf-8'), file);
    if (!doc) continue;

    const { unit, sources, updated } = doc.frontmatter;
    if (filter.domains && filter.domains.length > 0 && !filter.domains.includes(unit)) continue;

    // Domain node — identity is the `unit` frontmatter, never the disk path.
    graph.addNode({
      id: unit,
      type: 'domain',
      label: unit,
      metadata: { unit, updated, sources, path: file },
    });

    // Concern nodes (level-2 headings) --about--> domain.
    for (const concern of doc.concerns) {
      const concernId = `${unit}#${concern}`;
      graph.addNode({
        id: concernId,
        type: 'concern',
        label: `${unit} · ${concern}`,
        metadata: { concern, unit },
      });
      graph.addEdge({ from: concernId, to: unit, type: 'about', label: 'about' });
    }

    // Provenance: domain --sources--> story|epic. Skip targets not in the graph
    // (e.g. a source outside the current filter slice) so edges never dangle.
    for (const target of sources) {
      if (!graph.getNode(target)) continue;
      graph.addEdge({ from: unit, to: target, type: 'sources', label: 'sources' });
    }
  }
}
