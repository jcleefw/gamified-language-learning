import { ProjectGraph } from './graph.js';
import { loadArchiveIndex, buildProvenanceIndex } from './readers/archive.js';
import { ingestKnowledge } from './readers/knowledge.js';

export interface BuildOptions {
  /** Restrict provenance to stories in these tracks (e.g. ['project']); null = all. */
  tracks?: string[] | null;
  /** Restrict to these workspace units; null/undefined = all. */
  domains?: string[] | null;
}

/**
 * Build the concern-centric knowledge graph from a repo/fixture `root`.
 *
 * The archive is distilled into a provenance index (no nodes); the KNOWLEDGE.md
 * files supply the actual domain/concern nodes and content, with provenance
 * stamped on each concern and cross-domain `relates` edges drawn from shared epics.
 */
export function buildGraph(root: string, options: BuildOptions = {}): ProjectGraph {
  const graph = new ProjectGraph();
  const filter = { tracks: options.tracks ?? null, domains: options.domains ?? null };

  const archive = loadArchiveIndex(root);
  const provenance = buildProvenanceIndex(archive, filter);
  ingestKnowledge(graph, root, { domains: filter.domains }, provenance);

  return graph;
}
