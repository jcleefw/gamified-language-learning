import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '@gll/db';
import {
  DeckDocSchema,
  DeckMarkerMapSchema,
  type DeckDoc,
  type DeckMarkerMap,
} from '@gll/api-contract';

// EP43-DS02 ST05 — `apply-markers`: the seed/import half of the marking-ADR's
// Pass 1. It ingests a marker map exported by the ST04 browser tool and writes
// each sentence's audioStart/audioEnd into decks.doc.sentences[] IN PLACE, matched
// by sentenceId. It does NOT re-run importCurriculum (that regenerates sentenceIds
// and would orphan the map). No server route, no wire/schema change — a DB write
// through tooling, so Pass 1's no-server-write constraint holds.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type DbClient = BetterSQLite3Database<typeof schema>;

export interface ApplyMarkersResult {
  matched: number;
  skippedUnknown: string[]; // map keys with no matching sentenceId
}

/**
 * Apply `map` to the deck it targets. Fails loudly if the deck does not exist
 * (mirrors curate-audio's no-orphan guarantee). Idempotent: re-applying the same
 * map yields byte-identical markers. The map is pre-validated (end > start ≥ 0)
 * by DeckMarkerMapSchema at the parse boundary, so this only matches by id.
 */
export function applyMarkers(db: DbClient, map: DeckMarkerMap): ApplyMarkersResult {
  const rows = db
    .select({ doc: schema.decks.doc })
    .from(schema.decks)
    .where(eq(schema.decks.id, map.deckId))
    .all();
  if (rows.length === 0) {
    throw new Error(`apply-markers: unknown deck '${map.deckId}' — nothing to apply`);
  }

  const doc: DeckDoc = DeckDocSchema.parse(rows[0].doc);
  const knownIds = new Set(doc.sentences.map((s) => s.sentenceId));

  let matched = 0;
  for (const sentence of doc.sentences) {
    const marker = map.markers[sentence.sentenceId];
    if (marker) {
      sentence.audioStart = marker.start;
      sentence.audioEnd = marker.end;
      matched++;
    }
  }

  // Map keys that match no sentence in this deck — reported, never written.
  const skippedUnknown = Object.keys(map.markers).filter((id) => !knownIds.has(id));

  db.update(schema.decks)
    .set({ doc })
    .where(eq(schema.decks.id, map.deckId))
    .run();

  return { matched, skippedUnknown };
}

/** Read + zod-validate a marker-map file. Inverted/zero-length pairs are rejected
 *  here (never written) — the same invariant the export side enforces. */
export function loadMarkerMap(filePath: string): DeckMarkerMap {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  return DeckMarkerMapSchema.parse(raw);
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mapPath = process.argv[2];
  if (!mapPath) {
    console.error('Usage: apply-markers <path-to-marker-map.json>');
    process.exit(1);
  }

  const { getDb, closeDb } = await import('@gll/db');
  const DB_PATH =
    process.env.GLL_DB_PATH ??
    path.resolve(__dirname, '../../../.data/learning-state.db');

  const db = getDb(DB_PATH) as DbClient;
  try {
    const map = loadMarkerMap(path.resolve(mapPath));
    const { matched, skippedUnknown } = applyMarkers(db, map);
    console.log(
      `[INFO] apply-markers: deck '${map.deckId}' — matched ${matched} sentence(s).`,
    );
    if (skippedUnknown.length > 0) {
      console.warn(
        `[WARN] ${skippedUnknown.length} map key(s) matched no sentenceId (skipped): ${skippedUnknown.join(', ')}`,
      );
    }
  } finally {
    closeDb();
  }
}
