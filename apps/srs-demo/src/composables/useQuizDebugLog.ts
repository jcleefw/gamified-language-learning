import type { QuizItem, QuizQuestion } from '@gll/srs-engine-v2';

const DEBUG_LOG_DIR = 'manual-test-results';

interface LogEntry {
  timestamp: string;
  event: string;
  data: unknown;
}

const logs: LogEntry[] = [];

function formatTimestamp(): string {
  return new Date().toISOString();
}

function serializePool(pool: QuizItem[]): Array<{ id: string; native: string }> {
  return pool.map(item => ({
    id: item.id,
    native: item.native,
  }));
}

function serializeQuestions(questions: QuizQuestion[]): Array<{ wordId?: string; sentenceId?: string; direction: string; kind: string }> {
  return questions.map(q => ({
    ...(q.kind === 'mcq' && { wordId: q.wordId }),
    ...(q.kind === 'word-block' && { sentenceId: q.sentenceId }),
    direction: q.direction,
    kind: q.kind,
  }));
}

export function logDeckStarted(poolSize: number, pool: QuizItem[]): void {
  logs.push({
    timestamp: formatTimestamp(),
    event: 'DECK_STARTED',
    data: {
      poolSize,
      pool: serializePool(pool),
    },
  });
}

export function logBatchStarted(poolSize: number, pool: QuizItem[], batchNum: number): void {
  logs.push({
    timestamp: formatTimestamp(),
    event: 'BATCH_STARTED',
    data: {
      batchNum,
      poolSize,
      pool: serializePool(pool),
    },
  });
}

export function logBatchQuestions(batchNum: number, questions: QuizQuestion[], totalQuestions: number): void {
  logs.push({
    timestamp: formatTimestamp(),
    event: 'BATCH_QUESTIONS_SERVED',
    data: {
      batchNum,
      questionsCount: questions.length,
      totalQuestions,
      questions: serializeQuestions(questions),
    },
  });
}

export function logBatchResult(batchNum: number, correct: number, total: number, poolSize: number, pool: QuizItem[]): void {
  logs.push({
    timestamp: formatTimestamp(),
    event: 'BATCH_RESULT',
    data: {
      batchNum,
      correct,
      total,
      accuracy: total > 0 ? (correct / total * 100).toFixed(1) + '%' : 'N/A',
      poolSizeAfter: poolSize,
      poolAfter: serializePool(pool),
    },
  });
}

export async function flushLogs(): Promise<void> {
  if (logs.length === 0) return;

  const logContent = JSON.stringify(logs, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `debug-${timestamp}.json`;

  try {
    const response = await fetch('/api/debug-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content: logContent }),
    });

    if (!response.ok) {
      console.error(`Failed to flush logs: ${response.status}`);
    }
  } catch (error) {
    console.error('Error flushing logs:', error);
  }
}

export function clearLogs(): void {
  logs.length = 0;
}

export function getLogs(): LogEntry[] {
  return [...logs];
}
