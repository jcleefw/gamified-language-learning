import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '@gll/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, '../../..');

interface Component {
  thai: string;
  romanization: string;
  english: string;
  type: string;
}

interface BreakdownEntry {
  thai: string;
  romanization: string;
  english: string;
  components: Component[];
}

interface Conversation {
  id: string;
  topic: string;
  difficulty?: string;
  register?: string;
  lines: Array<{ speaker: string; thai: string; english: string; romanization: string }>;
  breakdown: BreakdownEntry[];
  uniqueWords: Array<{ thai: string; romanization: string; english: string; type: string }>;
  createdAt?: number;
}

interface FoundationalEntry {
  id: string;
  native: string;
  romanization: string;
  english: string;
  language: string;
}

type DbClient = BetterSQLite3Database<typeof schema>;

function loadConversations(): Conversation[] {
  const p = path.join(
    REPO_ROOT,
    'packages/srs-engine-v2/data/samples/conversations-2026-03-08.json',
  );
  return JSON.parse(readFileSync(p, 'utf-8')) as Conversation[];
}

async function loadFoundationalWords(): Promise<FoundationalEntry[]> {
  const p = path.join(
    REPO_ROOT,
    'packages/srs-engine-v2/data/seed-data/thai-full-foundations.ts',
  );
  // Dynamic import works under tsx (CLI) and vite (tests)
  const mod = await import(p);
  const result: FoundationalEntry[] = [];
  for (const list of [mod.thaiConsonants, mod.thaiVowels, mod.thaiTones] as FoundationalEntry[][]) {
    result.push(...list);
  }
  return result;
}

export function importCurriculum(db: DbClient, foundationalWords?: FoundationalEntry[]): void {
  const conversations = loadConversations();

  // Dedup map: "th::<thai-text>" → UUID
  const wordIdMap = new Map<string, string>();

  // Collect all unique words from uniqueWords + breakdown components
  for (const conv of conversations) {
    for (const w of conv.uniqueWords) {
      const key = `th::${w.thai}`;
      if (!wordIdMap.has(key)) wordIdMap.set(key, randomUUID());
    }
    for (const entry of conv.breakdown) {
      for (const comp of entry.components) {
        const key = `th::${comp.thai}`;
        if (!wordIdMap.has(key)) wordIdMap.set(key, randomUUID());
      }
    }
  }

  // Insert unique words
  for (const [key, id] of wordIdMap) {
    const thai = key.slice(4);
    let romanization = '';
    let english = '';
    let wordType = '';
    outer: for (const conv of conversations) {
      for (const w of conv.uniqueWords) {
        if (w.thai === thai) {
          romanization = w.romanization;
          english = w.english;
          wordType = w.type;
          break outer;
        }
      }
      for (const entry of conv.breakdown) {
        for (const comp of entry.components) {
          if (comp.thai === thai) {
            romanization = comp.romanization;
            english = comp.english;
            wordType = comp.type;
            break outer;
          }
        }
      }
    }

    db.insert(schema.words)
      .values({ id, language: 'th', text: thai, senses: JSON.stringify([{ romanization, english, type: wordType }]) })
      .onConflictDoNothing()
      .run();
  }

  // Insert decks + sentences + sentence_components + deck_words
  for (const conv of conversations) {
    const deckId = conv.id;
    const createdAt = new Date(conv.createdAt ?? Date.now()).toISOString();

    db.insert(schema.decks)
      .values({
        id: deckId,
        name: conv.topic,
        language: 'th',
        difficulty: conv.difficulty ?? null,
        register: conv.register ?? null,
        created_at: createdAt,
      })
      .onConflictDoNothing()
      .run();

    const deckWordIds = new Set<string>();

    for (let si = 0; si < conv.breakdown.length; si++) {
      const entry = conv.breakdown[si];
      const sentenceId = randomUUID();

      db.insert(schema.sentences)
        .values({
          id: sentenceId,
          deck_id: deckId,
          language: 'th',
          text: entry.thai,
          english: entry.english,
          romanization: entry.romanization,
          speaker: null,
          position: si,
        })
        .onConflictDoNothing()
        .run();

      for (let ci = 0; ci < entry.components.length; ci++) {
        const comp = entry.components[ci];
        const wordId = wordIdMap.get(`th::${comp.thai}`);
        if (!wordId) continue;

        db.insert(schema.sentence_components)
          .values({
            id: randomUUID(),
            sentence_id: sentenceId,
            word_id: wordId,
            position: ci,
            romanization: comp.romanization,
            english: comp.english,
          })
          .onConflictDoNothing()
          .run();

        deckWordIds.add(wordId);
      }
    }

    for (const wordId of deckWordIds) {
      db.insert(schema.deck_words)
        .values({ deck_id: deckId, word_id: wordId })
        .onConflictDoNothing()
        .run();
    }
  }

  // Insert foundational words (passed in or loaded dynamically)
  if (foundationalWords) {
    for (const fw of foundationalWords) {
      db.insert(schema.foundational_words)
        .values({ id: fw.id, language: fw.language, text: fw.native, romanization: fw.romanization, english: fw.english })
        .onConflictDoNothing()
        .run();
    }
  }
}

export async function importCurriculumWithFoundations(db: DbClient): Promise<void> {
  const foundationalWords = await loadFoundationalWords();
  importCurriculum(db, foundationalWords);
}

// CLI entrypoint
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { getDb, closeDb } = await import('@gll/db');
  const { mkdirSync } = await import('fs');

  const DB_PATH = process.env.GLL_DB_PATH ?? path.resolve(__dirname, '../../../.data/learning-state.db');
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = getDb(DB_PATH);
  console.log('[INFO] Starting curriculum import...');
  await importCurriculumWithFoundations(db as DbClient);
  console.log('[INFO] Curriculum import complete.');
  closeDb();
}
