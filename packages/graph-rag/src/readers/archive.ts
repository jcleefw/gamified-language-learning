import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Archive reader — PROVENANCE ONLY.
//
// In the ryoiki-centric model the archive produces no nodes. Instead it is
// distilled into a provenance index: for each (domain, ryoiki) pair, which
// stories / epics / PRs produced it. The knowledge reader stamps that onto the
// ryoiki nodes as metadata and uses the epic spans to draw `relates` edges
// between ryoiki that co-evolved in the same epic.
//
// `ryoiki` is the within-unit knowledge axis — the aspect a story touched, and
// the text of a KNOWLEDGE.md `##` heading. The join to headings is alias-aware:
// story ryoiki are canonicalized (see readers/ryoiki-config.ts) before keying,
// so drift variants (`fsrs`, `scheduler`) still meet their heading
// (`spaced-repetition`).
//
// Reads .agents/changelogs/archive/index.json. Never writes.
// ---------------------------------------------------------------------------

export const ARCHIVE_RELATIVE_PATH = join('.agents', 'changelogs', 'archive', 'index.json');

export interface ArchiveStory {
  id: string;
  epic: string;
  track: string;
  title: string;
  domain: string;
  ryoiki: string;
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

/** Provenance for one (domain, ryoiki) pair — the work that produced it. */
export interface RyoikiProvenance {
  stories: string[]; // story ids, in archive order
  epics: string[]; // unique epic ids that produced this ryoiki
  prs: number[]; // unique PR numbers
}

export interface ProvenanceIndex {
  /** key = ryoikiKey(domain, ryoiki) -> the work that produced it. */
  byRyoiki: Map<string, RyoikiProvenance>;
  /** epicId -> the set of ryoikiKeys it produced (drives cross-domain `relates`). */
  epicSpan: Map<string, Set<string>>;
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

/** Fold a ryoiki label to a match key: 'App Shell' and 'app-shell' collide. */
export function normalizeRyoiki(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Stable key joining a domain (workspace unit) with a normalized ryoiki. */
export function ryoikiKey(domain: string, ryoiki: string): string {
  return `${domain} ${normalizeRyoiki(ryoiki)}`;
}

/** The domain portion of a ryoikiKey. */
export function domainOfKey(key: string): string {
  return key.slice(0, key.indexOf(' '));
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
 * Distill the archive into a provenance index keyed by (domain, ryoiki). Only
 * stories carrying both a domain and a ryoiki contribute — a story with no
 * ryoiki has nowhere to attach in a ryoiki-centric graph. `canonicalize` folds
 * drift variants to their canonical ryoiki so the key matches the heading's.
 */
export function buildProvenanceIndex(
  archive: ArchiveIndex,
  filter: ArchiveFilter = {},
  canonicalize: (name: string) => string = (name) => name,
): ProvenanceIndex {
  const byRyoiki = new Map<string, RyoikiProvenance>();
  const epicSpan = new Map<string, Set<string>>();

  for (const story of archive.stories) {
    if (!passesFilter(story, filter)) continue;
    if (!story.domain || !story.ryoiki) continue;

    const key = ryoikiKey(story.domain, canonicalize(story.ryoiki));
    let prov = byRyoiki.get(key);
    if (!prov) {
      prov = { stories: [], epics: [], prs: [] };
      byRyoiki.set(key, prov);
    }
    prov.stories.push(story.id);
    if (story.epic && !prov.epics.includes(story.epic)) prov.epics.push(story.epic);
    if (typeof story.pr === 'number' && !prov.prs.includes(story.pr)) prov.prs.push(story.pr);

    if (story.epic) {
      let span = epicSpan.get(story.epic);
      if (!span) {
        span = new Set<string>();
        epicSpan.set(story.epic, span);
      }
      span.add(key);
    }
  }

  return { byRyoiki, epicSpan };
}
