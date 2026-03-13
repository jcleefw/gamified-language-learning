/**
 * Route tests for POST /api/srs/batch and POST /api/srs/answers (EP13-ST02, EP13-ST03).
 * Seeds the in-memory store before each test and clears the batch registry after.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app from '../../app.js';
import { seedStore, deckId } from '../../state/store.js';
import { clearRegistry } from '../../state/batchRegistry.js';
import type { WordState } from '@gll/srs-engine';
import type { WordDetail } from '../../state/store.js';
import type { ApiResponse, BatchPayload, SubmitAnswersResponse } from '@gll/api-contract';

const WORD_ID = 'word-001';

const testWordState: WordState = {
  wordId: WORD_ID,
  category: 'curated',
  masteryCount: 0,
  phase: 'learning',
  lapseCount: 0,
  correctCount: 0,
  wrongCount: 0,
};

const testWordDetail: WordDetail = {
  native: '안녕',
  romanization: 'annyeong',
  english: 'hello',
  category: 'curated',
};

function makeStore(count: number): { states: WordState[]; details: Map<string, WordDetail> } {
  const states: WordState[] = Array.from({ length: count }, (_, i) => ({
    ...testWordState,
    wordId: `word-${String(i).padStart(3, '0')}`,
  }));
  const details = new Map<string, WordDetail>(
    states.map((s) => [s.wordId, { ...testWordDetail }]),
  );
  return { states, details };
}

describe('POST /api/srs/answers', () => {
  beforeEach(() => {
    const { states, details } = makeStore(20);
    seedStore(states, details);
  });

  afterEach(() => {
    clearRegistry();
  });

  it('returns 404 when batchId is not in registry', async () => {
    const res = await app.request('/api/srs/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId: 'unknown-id', answers: [] }),
    });

    expect(res.status).toBe(404);
    const body = await res.json() as ApiResponse<never>;
    expect(body.success).toBe(false);
    expect((body as { success: false; error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with processed count and updatedWords on valid answers', async () => {
    // First get a batch to obtain a valid batchId
    const batchRes = await app.request('/api/srs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    });
    const batchBody = await batchRes.json() as ApiResponse<BatchPayload>;
    expect(batchBody.success).toBe(true);
    if (!batchBody.success) return;

    const { batchId, questions } = batchBody.data;
    const answers = questions.map((q) => ({ wordId: q.wordId, correct: true }));

    const answersRes = await app.request('/api/srs/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, answers }),
    });

    expect(answersRes.status).toBe(200);
    const answersBody = await answersRes.json() as ApiResponse<SubmitAnswersResponse>;
    expect(answersBody.success).toBe(true);
    if (answersBody.success) {
      expect(answersBody.data.processed).toBe(answers.length);
      expect(answersBody.data.updatedWords.length).toBe(answers.length);
      const validPhases = ['learning', 'anki_review'];
      for (const word of answersBody.data.updatedWords) {
        expect(typeof word.wordId).toBe('string');
        expect(typeof word.masteryCount).toBe('number');
        expect(validPhases).toContain(word.phase);
      }
    }
  });
});

describe('E2E: batch → answers', () => {
  beforeEach(() => {
    const { states, details } = makeStore(20);
    seedStore(states, details);
  });

  afterEach(() => {
    clearRegistry();
  });

  it('submitting all-correct answers increases masteryCount for each answered word', async () => {
    const batchRes = await app.request('/api/srs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    });
    const batchBody = await batchRes.json() as ApiResponse<BatchPayload>;
    expect(batchBody.success).toBe(true);
    if (!batchBody.success) return;

    const { batchId, questions } = batchBody.data;
    const answers = questions.map((q) => ({ wordId: q.wordId, correct: true }));

    const answersRes = await app.request('/api/srs/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, answers }),
    });

    expect(answersRes.status).toBe(200);
    const answersBody = await answersRes.json() as ApiResponse<SubmitAnswersResponse>;
    expect(answersBody.success).toBe(true);
    if (!answersBody.success) return;

    expect(answersBody.data.processed).toBe(questions.length);
    expect(answersBody.data.updatedWords.length).toBeGreaterThan(0);

    const validPhases = ['learning', 'anki_review'];
    for (const word of answersBody.data.updatedWords) {
      expect(validPhases).toContain(word.phase);
      expect(word.masteryCount).toBeGreaterThan(0);
    }
  });
});

describe('POST /api/srs/batch', () => {
  beforeEach(() => {
    const { states, details } = makeStore(20);
    seedStore(states, details);
  });

  afterEach(() => {
    clearRegistry();
  });

  it('returns 400 when deckId does not match', async () => {
    const res = await app.request('/api/srs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId: 'wrong-id' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as ApiResponse<never>;
    expect(body.success).toBe(false);
    expect((body as { success: false; error: { code: string; message: string } }).error.code).toBe('BAD_REQUEST');
  });

  it('returns 200 with BatchPayload when deckId matches', async () => {
    const res = await app.request('/api/srs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ApiResponse<BatchPayload>;
    expect(body.success).toBe(true);
    if (body.success) {
      expect(typeof body.data.batchId).toBe('string');
      expect(body.data.questions.length).toBeGreaterThan(0);
      expect(typeof body.data.batchSize).toBe('number');
    }
  });

  it('maps engine question types to wire format', async () => {
    const res = await app.request('/api/srs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ApiResponse<BatchPayload>;
    expect(body.success).toBe(true);
    if (body.success) {
      const validTypes = ['multiple_choice', 'word_block', 'audio'];
      for (const q of body.data.questions) {
        expect(validTypes).toContain(q.questionType);
        expect(typeof q.targetText).toBe('string');
        expect(typeof q.wordId).toBe('string');
      }
    }
  });
});
