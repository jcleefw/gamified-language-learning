import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from '../graph.js';
import { concernKey } from './archive.js';

// ---------------------------------------------------------------------------
// ADR reader — the DECISION layer (the *why*).
//
// ADRs live in <root>/product-documentation/architecture/*.md and use markdown
// bold fields (`**Status:**`, `**Date:**`, …), NOT YAML frontmatter. They ingest
// AS-IS as standalone `adr` nodes and start FLOATING — no prose is mined for
// concern links (staying true to EXTRACTION_PATTERNS.md's "no prose mining").
//
// A human links an ADR to the concern(s) it governs; that link is authored back
// into the ADR's `**Decides:**` field (the SOURCE OF TRUTH), so a reset + rebuild
// reconstructs it by re-reading the ADR. Two edge kinds come out:
//   - decides   : adr -> concern|domain   (from the `**Decides:**` field)
//   - supersedes: adr -> adr              (auto-parsed from `Superseded by` /
//                 `Amended by` links in the Status/header block; best-effort)
//
// Reads only. The write-back that maintains `**Decides:**` lives in server/serve.ts.
// ---------------------------------------------------------------------------

export const ADR_RELATIVE_DIR = join('product-documentation', 'architecture');

/** Filenames look like `20260713T140218Z-engineering-audio-playback-model.md`. */
const TIMESTAMP_PREFIX = /^\d{8}T\d{6}Z-/;
const ADR_LINK = /\]\((?:\.\/)?\d{8}T\d{6}Z-([a-z0-9-]+)\.md\)/g;

/** One superseder→superseded lineage claim found in an ADR's header. */
export interface AdrLineage {
  supersederSlug: string; // the newer decision (the arrow's tail)
  supersededSlug: string; // the older decision it replaces/amends (the arrow's head)
}

export interface AdrDoc {
  slug: string; // filename minus the timestamp prefix and `.md`
  title: string; // the first `# ` heading
  status: string; // first token of `**Status:**` (Accepted | Superseded | Proposed | …)
  date: string;
  deciders: string;
  scope: string;
  content: string; // the body after the header block — carried for search/detail
  decides: string[]; // `**Decides:**` targets: `domain#Concern` or bare `domain`
  lineage: AdrLineage[]; // adr→adr supersedes claims (slugs, unresolved to nodes)
  path: string;
}

/** `20260713T140218Z-engineering-audio-playback-model.md` -> the slug after the timestamp. */
export function adrSlug(filename: string): string {
  return filename.replace(TIMESTAMP_PREFIX, '').replace(/\.md$/, '');
}

/** List every ADR markdown file directly under product-documentation/architecture/. */
export function findAdrFiles(root: string): string[] {
  const dir = join(root, ADR_RELATIVE_DIR);
  let entries: import('fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(dir, e.name))
    .sort();
}

function boldField(block: string, name: string): string {
  const m = block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : '';
}

/**
 * Parse one ADR. Returns null for files that aren't ADRs (no `**Status:**` line) —
 * e.g. stray notes in the architecture dir. Only structured fields are read; the
 * prose is carried verbatim as `content`, never mined for structure.
 */
export function parseAdr(content: string, path: string): AdrDoc | null {
  // Header block = everything before the first `---` separator (where the body starts).
  const sepIdx = content.search(/\n---\n/);
  const header = sepIdx >= 0 ? content.slice(0, sepIdx) : content;
  const body = sepIdx >= 0 ? content.slice(sepIdx + 5).trim() : '';

  const status = boldField(header, 'Status').split(/[\s—(]/)[0].trim();
  if (!status) return null; // not an ADR

  const filename = path.slice(path.lastIndexOf('/') + 1);
  const titleMatch = content.match(/^#\s+(.+)$/m);

  const decidesRaw = boldField(header, 'Decides');
  const decides = decidesRaw
    ? decidesRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    slug: adrSlug(filename),
    title: titleMatch ? titleMatch[1].trim() : adrSlug(filename),
    status,
    date: boldField(header, 'Date'),
    deciders: boldField(header, 'Deciders'),
    scope: boldField(header, 'Scope'),
    content: body,
    decides,
    lineage: parseLineage(header, adrSlug(filename)),
    path,
  };
}

/**
 * Best-effort adr→adr lineage from the header block. `Superseded by` / `Amended by`
 * name a NEWER decision that replaces THIS one (edge newer→this); an active
 * `supersedes` names an OLDER one (edge this→older).
 */
function parseLineage(header: string, thisSlug: string): AdrLineage[] {
  const out: AdrLineage[] = [];
  const linksIn = (segment: string): string[] => {
    const slugs: string[] = [];
    for (const m of segment.matchAll(ADR_LINK)) if (m[1] !== thisSlug) slugs.push(m[1]);
    return slugs;
  };
  for (const m of header.matchAll(/(?:superseded[^\n]*?by|amended by)[^\n]*/gi)) {
    for (const slug of linksIn(m[0])) out.push({ supersederSlug: slug, supersededSlug: thisSlug });
  }
  for (const m of header.matchAll(/(?<![a-z])supersedes[^\n]*/gi)) {
    for (const slug of linksIn(m[0])) out.push({ supersederSlug: thisSlug, supersededSlug: slug });
  }
  return out;
}

/**
 * Read every ADR into the graph as `adr` nodes, drawing `decides` edges to the
 * concern/domain nodes they govern and `supersedes` edges between ADRs. MUST run
 * AFTER ingestKnowledge so the concern/domain nodes a `**Decides:**` field points
 * at already exist — an unmatched target simply leaves the ADR floating.
 */
export function ingestAdrs(graph: ProjectGraph, root: string): void {
  // Resolve a `**Decides:**` target to an existing node id, or null if unbuilt.
  const concernByKey = new Map<string, string>(); // concernKey -> node id
  for (const node of graph.nodes.values()) {
    if (node.type === 'concern') {
      const unit = String(node.metadata.unit ?? '');
      const concern = String(node.metadata.concern ?? '');
      concernByKey.set(concernKey(unit, concern), node.id);
    }
  }
  const resolveTarget = (target: string): string | null => {
    const hash = target.indexOf('#');
    if (hash < 0) return graph.getNode(target)?.type === 'domain' ? target : null;
    const domain = target.slice(0, hash);
    const concern = target.slice(hash + 1);
    return concernByKey.get(concernKey(domain, concern)) ?? null;
  };

  const lineage: AdrLineage[] = [];
  for (const file of findAdrFiles(root)) {
    const doc = parseAdr(readFileSync(file, 'utf-8'), file);
    if (!doc) continue;

    const id = `adr:${doc.slug}`;
    graph.addNode({
      id,
      type: 'adr',
      label: doc.title,
      metadata: {
        slug: doc.slug,
        status: doc.status,
        date: doc.date,
        deciders: doc.deciders,
        scope: doc.scope,
        content: doc.content,
        decides: doc.decides,
        path: file,
      },
    });

    for (const target of doc.decides) {
      const to = resolveTarget(target);
      if (to) graph.addEdge({ from: id, to, type: 'decides', label: 'decides' });
    }
    lineage.push(...doc.lineage);
  }

  // Lineage edges last, so both endpoint nodes exist regardless of file order.
  for (const { supersederSlug, supersededSlug } of lineage) {
    const from = `adr:${supersederSlug}`;
    const to = `adr:${supersededSlug}`;
    if (graph.getNode(from) && graph.getNode(to)) {
      graph.addEdge({ from, to, type: 'supersedes', label: 'supersedes' });
    }
  }
}
