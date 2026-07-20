import { ProjectGraph } from './graph.js';
import { loadArchiveIndex, buildProvenanceIndex } from './readers/archive.js';
import { ingestKnowledge } from './readers/knowledge.js';
import { ingestAdrs } from './readers/adr.js';
import { loadRyoikiConfig } from './readers/ryoiki-config.js';

export interface BuildOptions {
  /** Restrict provenance to stories in these tracks (e.g. ['project']); null = all. */
  tracks?: string[] | null;
  /** Restrict to these workspace units; null/undefined = all. */
  domains?: string[] | null;
  /** Set false to skip ADR ingestion entirely — no adr nodes/edges. Default true. */
  includeAdrs?: boolean;
  /** Restrict ADR ingestion to specific files (filename or slug); null/undefined = every ADR. */
  adrFiles?: string[] | null;
}

/**
 * Build the ryoiki-centric knowledge graph from a repo/fixture `root`.
 *
 * The ryoiki reference config (alias map + blacklist) is loaded first: aliases
 * feed the provenance join so drift variants meet their heading, and the
 * blacklist keeps excluded ryoiki out of the graph entirely. The archive is
 * distilled into a provenance index (no nodes); the KNOWLEDGE.md files supply
 * the domain/ryoiki nodes and content, with provenance stamped on each ryoiki
 * and cross-domain `relates` edges drawn from shared epics. ADRs ingest last.
 */
export function buildGraph(root: string, options: BuildOptions = {}): ProjectGraph {
  const graph = new ProjectGraph();
  const filter = { tracks: options.tracks ?? null, domains: options.domains ?? null };

  const config = loadRyoikiConfig(root);
  const archive = loadArchiveIndex(root);
  const provenance = buildProvenanceIndex(archive, filter, config.canonicalize);
  ingestKnowledge(graph, root, { domains: filter.domains }, provenance, config);
  // ADRs last: the decision layer links to ryoiki/domain nodes just created.
  if (options.includeAdrs ?? true) {
    ingestAdrs(graph, root, config.canonicalize, options.adrFiles ?? null);
  }

  return graph;
}
