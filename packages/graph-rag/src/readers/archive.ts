import { readFileSync } from 'fs';
import { join } from 'path';
import { ProjectGraph } from '../graph.js';

// ---------------------------------------------------------------------------
// Time axis reader: .agents/changelogs/archive/index.json
//
// Produces `story` and `epic` nodes. The epic is only ever an edge target:
//   epic --contains--> story        (from story.epic)
//   story --supersedes--> story     (from story.supersedes[])
//   story --fixes--> epic|story     (from story.fixes[])
//
// It does NOT create a grouping node per epic and it never mines file paths.
// ---------------------------------------------------------------------------

export const ARCHIVE_RELATIVE_PATH = join('.agents', 'changelogs', 'archive', 'index.json');

export interface ArchiveStory {
  id: string;
  epic: string;
  track: string;
  title: string;
  domain: string;
  concern: string;
  completed: string;
  duration?: string;
  summary: string;
  supersedes?: string[];
  fixes?: string[];
  pr?: number | null;
  compact_pr?: number | null;
}

export interface ArchiveEpic {
  title: string;
  domains?: string[];
  archived?: string;
  notes?: string;
}

export interface ArchiveIndex {
  stories: ArchiveStory[];
  epics: Record<string, ArchiveEpic>;
}

export interface ArchiveFilter {
  tracks?: string[] | null;
  domains?: string[] | null;
}

export function loadArchiveIndex(root: string): ArchiveIndex {
  const path = join(root, ARCHIVE_RELATIVE_PATH);
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<ArchiveIndex>;
  return {
    stories: parsed.stories ?? [],
    epics: parsed.epics ?? {},
  };
}

function passesFilter(story: ArchiveStory, filter: ArchiveFilter): boolean {
  if (filter.tracks && filter.tracks.length > 0 && !filter.tracks.includes(story.track)) {
    return false;
  }
  if (filter.domains && filter.domains.length > 0 && !filter.domains.includes(story.domain)) {
    return false;
  }
  return true;
}

/**
 * Read the archive index into the graph as story/epic nodes and their edges.
 * `root` is the base the fixture/repo is mounted at (reader takes root as a param).
 */
export function ingestArchive(
  graph: ProjectGraph,
  root: string,
  filter: ArchiveFilter = {},
): void {
  const { stories, epics } = loadArchiveIndex(root);

  const included = stories.filter((s) => passesFilter(s, filter));
  const includedIds = new Set(included.map((s) => s.id));

  // Which epics are referenced by an included story — so we only surface epics
  // that are actually part of this slice.
  const referencedEpics = new Set<string>();
  for (const story of included) {
    if (story.epic) referencedEpics.add(story.epic);
    for (const target of story.fixes ?? []) referencedEpics.add(target);
  }

  // Epic nodes (edge targets only).
  for (const [epicId, epic] of Object.entries(epics)) {
    if (!referencedEpics.has(epicId)) continue;
    graph.addNode({
      id: epicId,
      type: 'epic',
      label: `${epicId}: ${epic.title}`,
      metadata: {
        title: epic.title,
        domains: epic.domains ?? [],
        archived: epic.archived,
        notes: epic.notes,
      },
    });
  }

  // Story nodes + edges.
  for (const story of included) {
    graph.addNode({
      id: story.id,
      type: 'story',
      label: `${story.id}: ${story.title}`,
      metadata: {
        epic: story.epic,
        track: story.track,
        domain: story.domain,
        concern: story.concern,
        completed: story.completed,
        duration: story.duration,
        summary: story.summary,
        pr: story.pr ?? null,
        compact_pr: story.compact_pr ?? null,
      },
    });

    // epic --contains--> story
    if (story.epic) {
      ensureEpicPlaceholder(graph, epics, story.epic);
      graph.addEdge({
        from: story.epic,
        to: story.id,
        type: 'contains',
        label: 'contains story',
      });
    }

    // story --supersedes--> story (only within the included slice)
    for (const target of story.supersedes ?? []) {
      if (includedIds.has(target)) {
        graph.addEdge({ from: story.id, to: target, type: 'supersedes', label: 'supersedes' });
      }
    }

    // story --fixes--> epic|story
    for (const target of story.fixes ?? []) {
      ensureEpicPlaceholder(graph, epics, target);
      graph.addEdge({ from: story.id, to: target, type: 'fixes', label: 'fixes' });
    }
  }
}

// A `fixes`/`contains` target may be an epic we didn't already materialize (e.g.
// an old epic referenced by `fixes` that has no included story). Materialize a
// minimal epic node so the edge resolves, rather than dangling.
function ensureEpicPlaceholder(
  graph: ProjectGraph,
  epics: Record<string, ArchiveEpic>,
  id: string,
): void {
  if (graph.getNode(id)) return;
  // Only epics get placeholders; story targets are expected to already exist.
  if (!/^[A-Z]+\d+$/.test(id)) return;
  const epic = epics[id];
  graph.addNode({
    id,
    type: 'epic',
    label: epic ? `${id}: ${epic.title}` : id,
    metadata: epic
      ? { title: epic.title, domains: epic.domains ?? [], archived: epic.archived, notes: epic.notes }
      : { title: id, unresolved: true },
  });
}
