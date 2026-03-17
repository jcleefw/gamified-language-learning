import type {
  ApiResponse,
  SeedPayload,
  BatchPayload,
  QuizQuestion,
  SubmitAnswersResponse,
  AnswerResultPayload,
} from '@gll/api-contract';

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

// ── Internal types ───────────────────────────────────────────────────────────

interface CollectedAnswer {
  wordId: string;
  selectedKey: string;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const envelope = (await response.json()) as ApiResponse<T>;

  if (!envelope.success) {
    const errorMessage = envelope.error.message;
    throw new Error(`${path} failed: ${errorMessage}`);
  }

  return envelope.data;
}

async function seed(): Promise<SeedPayload> {
  return postJson<SeedPayload>('/api/srs/seed', {});
}

async function getBatch(deckId: string): Promise<BatchPayload> {
  return postJson<BatchPayload>('/api/srs/batch', {
    deckId,
    clientCapabilities: { mc: true, wordBlock: false, audio: false },
  });
}

async function submitAnswers(
  batchId: string,
  answers: CollectedAnswer[],
): Promise<SubmitAnswersResponse> {
  return postJson<SubmitAnswersResponse>('/api/srs/answers', { batchId, answers });
}

// ── Input helper ─────────────────────────────────────────────────────────────

const VALID_KEYS = new Set(['a', 'b', 'c', 'd']);

async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');

    const onData = (chunk: string): void => {
      const key = chunk.toLowerCase();

      if (key === '\u0003') {
        // Ctrl+C — exit gracefully
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.log('\n\n  Quit. Goodbye!');
        process.exit(0);
      }

      if (VALID_KEYS.has(key)) {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve(key);
      } else {
        process.stdout.write('\r  → Your answer (a/b/c/d): ');
      }
    };

    process.stdin.on('data', onData);
  });
}

// ── Display helpers ───────────────────────────────────────────────────────────

function separator(): void {
  console.log(`\n${'─'.repeat(45)}`);
}

function displayQuestion(question: QuizQuestion, index: number, total: number, batchNumber: number): void {
  separator();
  console.log(`  Batch ${batchNumber} — Q${index} of ${total}`);
  separator();
  console.log(`\n  What sound does "${question.targetText}" make?\n`);
  for (const [key, value] of Object.entries(question.choices)) {
    console.log(`  ${key}) ${value}`);
  }
  console.log();
  process.stdout.write('  → Your answer (a/b/c/d): ');
}

function displayResults(
  updatedWords: AnswerResultPayload[],
  questions: QuizQuestion[],
): void {
  const questionByWordId = new Map(questions.map((q) => [q.wordId, q]));

  separator();
  console.log('  Results');
  separator();
  console.log();

  for (const result of updatedWords) {
    const question = questionByWordId.get(result.wordId);
    const label = question ? `${question.targetText} (${result.wordId})` : result.wordId;
    const prevMastery = result.masteryCount - (result.correct ? 1 : 0);

    if (result.correct) {
      console.log(`  ${label.padEnd(24)} ✓  mastery: ${prevMastery} → ${result.masteryCount}`);
    } else {
      console.log(
        `  ${label.padEnd(24)} ✗  you: ${result.submittedKey}  correct: ${result.correctKey}   mastery: ${prevMastery} → ${result.masteryCount}`,
      );
    }
  }

  console.log();
}

// ── Quiz loop ─────────────────────────────────────────────────────────────────

async function promptContinue(): Promise<boolean> {
  process.stdout.write('\n  Next batch? (Enter to continue, q to quit): ');

  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');

    const onData = (chunk: string): void => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();

      if (chunk === '\u0003' || chunk.toLowerCase() === 'q') {
        console.log('\n\n  Quit. Goodbye!');
        process.exit(0);
      }

      console.log();
      resolve(true);
    };

    process.stdin.on('data', onData);
  });
}

async function runQuiz(): Promise<void> {
  const seedData = await seed();
  console.log(`\nSeeded ${seedData.wordCount} words (${seedData.phase})`);

  let batchNumber = 0;

  for (;;) {
    const batch = await getBatch(seedData.deckId);
    const totalQuestions = batch.questions.length;

    if (totalQuestions === 0) {
      console.log('\n  No questions available. All words complete!');
      break;
    }

    batchNumber++;
    console.log(`\nBatch ${batchNumber} — ${totalQuestions} questions`);

    const collectedAnswers: CollectedAnswer[] = [];
    let questionNumber = 0;

    for (const question of batch.questions) {
      questionNumber++;
      displayQuestion(question, questionNumber, totalQuestions, batchNumber);

      const selectedKey = await readKey();
      console.log(selectedKey);

      collectedAnswers.push({ wordId: question.wordId, selectedKey });
    }

    if (collectedAnswers.length === 0) {
      console.log('\n  No answers collected this batch.');
    } else {
      const result = await submitAnswers(batch.batchId, collectedAnswers);
      displayResults(result.updatedWords, batch.questions);
    }

    await promptContinue();
  }

  process.exit(0);
}

runQuiz().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nQuiz runner error: ${message}`);
  process.exit(1);
});
