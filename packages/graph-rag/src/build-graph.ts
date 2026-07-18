import { ProjectGraph } from './graph.js';
import { ingestArchive } from './readers/archive.js';
import { ingestKnowledge } from './readers/knowledge.js';

export interface BuildOptions {
  /** Restrict stories to these tracks (e.g. ['project']); null/undefined = all. */
  tracks?: string[] | null;
  /** Restrict to these workspace units; null/undefined = all. */
  domains?: string[] | null;
}

/**
 * Build the whole two-axis graph from a repo/fixture `root`.
 *
 * Order matters: the archive reader runs first so story/epic nodes exist by the
 * time the KNOWLEDGE.md reader wires its `sources` provenance edges to them.
 */
export function buildGraph(root: string, options: BuildOptions = {}): ProjectGraph {
  const graph = new ProjectGraph();
  const filter = { tracks: options.tracks ?? null, domains: options.domains ?? null };

  ingestArchive(graph, root, filter);
  ingestKnowledge(graph, root, { domains: filter.domains });

  return graph;
}
