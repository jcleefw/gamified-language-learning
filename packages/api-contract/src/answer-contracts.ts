// Compile-time contract checks for POST /api/answer DTOs (EP37-ST01).
// Type-only: tsc erases these; there is no runtime behaviour. Acts as a
// regression guard that the DTOs exist and keep their shape.
import type {
  AnswerRequest,
  AnswerResponse,
  WordStatePayload,
} from './index.js';

// AnswerRequest is the raw answer the server derives state from.
const _req: AnswerRequest = { wordId: 'w1', correct: true, latencyMs: 1200 };
void _req;

// AnswerResponse.wordState is a WordStatePayload (reuses the existing DTO).
declare const payload: WordStatePayload;
const _res: AnswerResponse = { wordState: payload, graduated: false };
void _res;
