import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeRyoiki } from './archive.js';

// ---------------------------------------------------------------------------
// Ryoiki reference config — manages knowledge filtering via curated reference
// files. Two curated files under <root>/.agents/reference/ drive it:
//
//   - ryoiki-aliases.json   { canonical: { description, alias: [variants…] } }
//         Heals NAMING DRIFT. When the same aspect is spelled differently across
//         units or over time (`fsrs`, `scheduler` → `spaced-repetition`), the map
//         canonicalizes it so the provenance join and references still meet.
//
//   - ryoiki-blacklist.json { "*": […], "apps/srs-demo": […] }
//         Per-unit EXCLUSION. A blacklisted ryoiki is NEVER added to the graph
//         (the user's rule): its KNOWLEDGE.md heading is skipped at ingest. The
//         reserved "*" key applies to every unit, additive on top of its own
//         list. Cascading, longest-prefix-wins on the slash path.
//
// Both files are optional: a root with neither yields identity canonicalization
// and an empty blacklist (include-by-default). Reads only; nothing here ever
// writes the reference files.
// ---------------------------------------------------------------------------

const REFERENCE_DIR = join('.agents', 'reference');
const ALIASES_FILE = 'ryoiki-aliases.json';
const BLACKLIST_FILE = 'ryoiki-blacklist.json';

/** Reserved blacklist key whose entries apply to every unit. */
const GLOBAL_KEY = '*';

type AliasMap = Record<string, { description?: string; alias?: string[] }>;
type Blacklist = Record<string, string[]>;

export interface RyoikiConfig {
  /**
   * Fold a possibly-variant ryoiki name to its canonical spelling; returns the
   * name unchanged when no alias matches (ryoiki stay free-form — never rejected).
   */
  canonicalize(name: string): string;
  /**
   * True when `ryoiki` is excluded for `unit` — i.e. it must not become a node.
   * Merges the global "*" list with the unit's own, cascading longest-prefix-wins
   * on the slash path so a coarse entry drops itself and every descendant.
   */
  isBlacklisted(unit: string, ryoiki: string): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function readJson<T extends Record<string, unknown>>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/** Identity config: no aliasing, nothing excluded. Used when no reference dir exists. */
export const INCLUDE_ALL: RyoikiConfig = {
  canonicalize: (name) => name,
  isBlacklisted: () => false,
};

/**
 * Load the alias + blacklist reference files relative to `root`. Missing or
 * malformed files degrade to include-by-default, so a fixture or a repo without
 * the reference dir still builds a graph.
 */
export function loadRyoikiConfig(root: string): RyoikiConfig {
  const dir = join(root, REFERENCE_DIR);
  const aliases = readJson<AliasMap>(join(dir, ALIASES_FILE)) ?? {};
  const blacklist = readJson<Blacklist>(join(dir, BLACKLIST_FILE)) ?? {};

  // Reverse index: normalized variant -> canonical name. The canonical name
  // itself also maps to itself so an already-canonical input is stable.
  const toCanonical = new Map<string, string>();
  for (const [canonical, entry] of Object.entries(aliases)) {
    toCanonical.set(normalizeRyoiki(canonical), canonical);
    for (const variant of entry.alias ?? []) {
      toCanonical.set(normalizeRyoiki(variant), canonical);
    }
  }

  const canonicalize = (name: string): string => toCanonical.get(normalizeRyoiki(name)) ?? name;

  // Normalize each slash segment the way ryoikiKey does (so 'Type Definitions'
  // and 'type-definitions' collide) while KEEPING the slashes the prefix
  // cascade depends on. A leading-segment alias is folded first.
  const normPath = (p: string): string =>
    canonicalize(p)
      .split('/')
      .map(normalizeRyoiki)
      .filter(Boolean)
      .join('/');

  const isBlacklisted = (unit: string, ryoiki: string): boolean => {
    const entries = [...(blacklist[GLOBAL_KEY] ?? []), ...(blacklist[unit] ?? [])];
    if (entries.length === 0) return false;
    const path = normPath(ryoiki);
    return entries.some((raw) => {
      const entry = normPath(raw);
      return entry !== '' && (path === entry || path.startsWith(`${entry}/`));
    });
  };

  return { canonicalize, isBlacklisted };
}
