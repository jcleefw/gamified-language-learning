import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from '../graph.js';
import { concernKey } from './archive.js';
import type { ProvenanceIndex } from './archive.js';

// ---------------------------------------------------------------------------
// Knowledge reader: {apps,packages,...}/<unit>/KNOWLEDGE.md
//
// The knowledge graph IS this file's structure. It produces:
//   - domain node:   the workspace unit (frontmatter `unit`)
//   - concern node:  each level-2 heading, carrying the prose beneath it as its
//                    durable content, plus provenance stamped from the archive
//                    (which stories/epics/PRs produced it)
//   - contains edge: domain --contains--> concern
//   - relates edge:  concern --relates--> concern, for concerns in DIFFERENT
//                    domains that were produced by the same epic (co-evolution)
//
// Stories and epics are never nodes — only citations on the concerns.
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', '.agents', 'dist', 'coverage', '__fixtures__']);

export interface KnowledgeFrontmatter {
  unit: string;
  sources: string[];
  updated?: string;
}

export interface ConcernSection {
  title: string; // the level-2 heading text
  content: string; // the prose beneath it, up to the next heading
}

export interface KnowledgeDoc {
  frontmatter: KnowledgeFrontmatter;
  concerns: ConcernSection[];
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
 * Minimal parser for the fixed KNOWLEDGE.md shape (D5): a frontmatter block
 * (unit / sources / updated) followed by `## Concern` sections. The prose under
 * each heading — the actual knowledge — is captured as that concern's content.
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

  // Split the body on level-2 headings, keeping the prose that follows each.
  const concerns: ConcernSection[] = [];
  const headingRe = /^##\s+(.+?)\s*$/gm;
  const matches = [...body.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    concerns.push({ title, content: body.slice(start, end).trim() });
  }

  return {
    frontmatter: {
      unit: fm.unit.replace(/^["']|["']$/g, ''),
      sources: parseList(fm.sources),
      updated: fm.updated,
    },
    concerns,
    path,
  };
}

/**
 * Read every KNOWLEDGE.md below `root` into the graph as domain/concern nodes.
 * `provenance` (built from the archive) stamps each concern with the work that
 * produced it and drives the cross-domain `relates` edges.
 */
export function ingestKnowledge(
  graph: ProjectGraph,
  root: string,
  filter: KnowledgeFilter = {},
  provenance?: ProvenanceIndex,
): void {
  // concernKey -> { nodeId, domain }, so the relates pass can resolve co-evolved
  // concerns back to the nodes we created.
  const keyToNode = new Map<string, { id: string; domain: string }>();

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

    for (const { title, content } of doc.concerns) {
      const concernId = `${unit}#${title}`;
      const key = concernKey(unit, title);
      const prov = provenance?.byConcern.get(key);

      graph.addNode({
        id: concernId,
        type: 'concern',
        label: `${unit} · ${title}`,
        metadata: {
          concern: title,
          unit,
          updated,
          content,
          // Provenance as metadata — the work is a citation, not a node.
          sources: prov?.stories ?? [],
          epics: prov?.epics ?? [],
          prs: prov?.prs ?? [],
        },
      });
      graph.addEdge({ from: unit, to: concernId, type: 'contains', label: 'contains' });
      keyToNode.set(key, { id: concernId, domain: unit });
    }
  }

  wireRelates(graph, provenance, keyToNode);
}

/**
 * For each epic, connect the concerns it produced that live in DIFFERENT domains
 * — a `relates` edge meaning "these co-evolved in the same unit of work". Concerns
 * within one domain are already grouped by their shared domain node, so we don't
 * clutter the graph with intra-domain relates.
 */
function wireRelates(
  graph: ProjectGraph,
  provenance: ProvenanceIndex | undefined,
  keyToNode: Map<string, { id: string; domain: string }>,
): void {
  if (!provenance) return;

  for (const [epicId, keys] of provenance.epicSpan) {
    const nodes = [...keys].map((k) => keyToNode.get(k)).filter((n): n is { id: string; domain: string } => !!n);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].domain === nodes[j].domain) continue; // cross-domain only
        // Order the pair deterministically so A→B and B→A collapse to one edge.
        const [from, to] = nodes[i].id < nodes[j].id ? [nodes[i].id, nodes[j].id] : [nodes[j].id, nodes[i].id];
        graph.addEdge({ from, to, type: 'relates', label: `via ${epicId}` });
      }
    }
  }
}
