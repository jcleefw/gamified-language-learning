import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from '../graph.js';
import { ryoikiKey } from './archive.js';
import type { ProvenanceIndex } from './archive.js';
import { INCLUDE_ALL } from './ryoiki-config.js';
import type { RyoikiConfig } from './ryoiki-config.js';

// ---------------------------------------------------------------------------
// Knowledge reader: {apps,packages,...}/<unit>/KNOWLEDGE.md
//
// The knowledge graph IS this file's structure. It produces:
//   - domain node:   the workspace unit (frontmatter `unit`)
//   - ryoiki node:   each level-2 heading, carrying the prose beneath it as its
//                    durable content, plus provenance stamped from the archive
//                    (which stories/epics/PRs produced it)
//   - contains edge: domain --contains--> ryoiki
//   - relates edge:  ryoiki --relates--> ryoiki, for ryoiki in DIFFERENT
//                    domains that were produced by the same epic (co-evolution)
//
// A `ryoiki` (AGN06) is a named aspect of one unit — the text of a `##` heading.
// Blacklisted ryoiki are NEVER added to the graph: the heading is skipped at
// ingest (RyoikiConfig.isBlacklisted). The join to archive provenance is
// alias-aware — each heading is canonicalized before keying.
//
// Stories and epics are never nodes — only citations on the ryoiki.
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '.git', '.agents', 'dist', 'coverage', '__fixtures__']);

export interface KnowledgeFrontmatter {
  unit: string;
  sources: string[];
  updated?: string;
}

export interface RyoikiSection {
  title: string; // the level-2 heading text
  content: string; // the prose beneath it, up to the next heading
}

export interface KnowledgeDoc {
  frontmatter: KnowledgeFrontmatter;
  ryoiki: RyoikiSection[];
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
 * (unit / sources / updated) followed by `## Ryoiki` sections. The prose under
 * each heading — the actual knowledge — is captured as that ryoiki's content.
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
  const ryoiki: RyoikiSection[] = [];
  const headingRe = /^##\s+(.+?)\s*$/gm;
  const matches = [...body.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    ryoiki.push({ title, content: body.slice(start, end).trim() });
  }

  return {
    frontmatter: {
      unit: fm.unit.replace(/^["']|["']$/g, ''),
      sources: parseList(fm.sources),
      updated: fm.updated,
    },
    ryoiki,
    path,
  };
}

/**
 * Read every KNOWLEDGE.md below `root` into the graph as domain/ryoiki nodes.
 * `provenance` (built from the archive) stamps each ryoiki with the work that
 * produced it and drives the cross-domain `relates` edges. `config` carries the
 * alias map (for the provenance join key) and the blacklist (skips excluded
 * ryoiki so they never enter the graph).
 */
export function ingestKnowledge(
  graph: ProjectGraph,
  root: string,
  filter: KnowledgeFilter = {},
  provenance?: ProvenanceIndex,
  config: RyoikiConfig = INCLUDE_ALL,
): void {
  // ryoikiKey -> { nodeId, domain }, so the relates pass can resolve co-evolved
  // ryoiki back to the nodes we created.
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

    for (const { title, content } of doc.ryoiki) {
      // Blacklisted ryoiki are excluded by design — never a node (AGN06 D5/D9).
      // A blacklisted ryoiki should never have been WRITTEN as a heading in the
      // first place (the blacklist is a write-time projection), so its presence
      // here is an authoring anomaly: warn loudly, then skip so it still never
      // enters the graph.
      if (config.isBlacklisted(unit, title)) {
        console.warn(
          `[graph-rag] "${unit}" KNOWLEDGE.md has a blacklisted ryoiki heading ` +
            `"${title}" — it should never have been written (AGN06 D9). Skipping; ` +
            `not added to the graph.`,
        );
        continue;
      }

      const ryoikiId = `${unit}#${title}`;
      const key = ryoikiKey(unit, config.canonicalize(title));
      const prov = provenance?.byRyoiki.get(key);

      graph.addNode({
        id: ryoikiId,
        type: 'ryoiki',
        label: `${unit} · ${title}`,
        metadata: {
          ryoiki: title,
          unit,
          updated,
          content,
          // Provenance as metadata — the work is a citation, not a node.
          sources: prov?.stories ?? [],
          epics: prov?.epics ?? [],
          prs: prov?.prs ?? [],
        },
      });
      graph.addEdge({ from: unit, to: ryoikiId, type: 'contains', label: 'contains' });
      keyToNode.set(key, { id: ryoikiId, domain: unit });
    }
  }

  wireRelates(graph, provenance, keyToNode);
}

/**
 * For each epic, connect the ryoiki it produced that live in DIFFERENT domains
 * — a `relates` edge meaning "these co-evolved in the same unit of work". Ryoiki
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
