import type { QuizQuestion } from '../types/quiz.js';

/**
 * Safety constraints a finished batch must satisfy.
 * Pure integrity rules only — nothing about *how many* of each question type
 * to include (that is a composition/strategy concern, not a safety concern).
 */
export interface BatchConstraints {
  /**
   * Word IDs that must not appear anywhere in the batch — neither as a
   * standalone word question nor as a tile inside a sentence question.
   * Typically the learner's shelved set.
   */
  excludeIds?: Set<string>;
}

export type BatchViolation =
  | {
      kind: 'excluded-word';
      /** Index of the offending question within the batch. */
      questionIndex: number;
      questionKind: QuizQuestion['kind'];
      /** The excluded word that leaked in. */
      wordId: string;
      /** Present when the leak is a tile inside a sentence question. */
      sentenceId?: string;
    }
  | {
      kind: 'duplicate-question';
      /** Index of the second (and later) occurrence. */
      questionIndex: number;
      /** Stable identity that repeated, e.g. `mcq:w1:native-to-english`. */
      identity: string;
    };

export interface BatchValidation {
  /** True when no violations were found. */
  valid: boolean;
  violations: BatchViolation[];
}

/**
 * Inspect a finished batch and report safety violations.
 *
 * This is a pure predicate over the batch output — it never repairs, throws,
 * or reorders. Callers decide what to do with a failing result (assert in
 * dev/tests, log in production). It exists as a safety net: the shelved-word
 * leak (EP26-BUG01) is already closed at the source in `resolveEligibleContexts`,
 * so a violation here means a *new* consumer wired the sentence path without
 * threading `excludeIds` through, or a regression reopened the seam.
 *
 * Rules checked:
 *  1. No excluded word appears — as a word question or as a sentence tile.
 *  2. No duplicate question identity within the same batch.
 */
export function validateBatch(
  questions: QuizQuestion[],
  constraints: BatchConstraints = {},
): BatchValidation {
  const { excludeIds } = constraints;
  const violations: BatchViolation[] = [];
  const seenIdentities = new Set<string>();

  questions.forEach((q, questionIndex) => {
    // Rule 1 — no excluded word leaks in.
    if (excludeIds?.size) {
      if (q.kind === 'mcq') {
        if (excludeIds.has(q.wordId)) {
          violations.push({
            kind: 'excluded-word',
            questionIndex,
            questionKind: q.kind,
            wordId: q.wordId,
          });
        }
      } else {
        for (const tile of q.tiles) {
          if (excludeIds.has(tile.wordId)) {
            violations.push({
              kind: 'excluded-word',
              questionIndex,
              questionKind: q.kind,
              wordId: tile.wordId,
              sentenceId: q.sentenceId,
            });
          }
        }
      }
    }

    // Rule 2 — no duplicate question identity.
    const identity = questionIdentity(q);
    if (seenIdentities.has(identity)) {
      violations.push({ kind: 'duplicate-question', questionIndex, identity });
    } else {
      seenIdentities.add(identity);
    }
  });

  return { valid: violations.length === 0, violations };
}

/** Stable identity for duplicate detection: kind + subject + direction. */
function questionIdentity(q: QuizQuestion): string {
  return q.kind === 'mcq'
    ? `mcq:${q.wordId}:${q.direction}`
    : `word-block:${q.sentenceId}:${q.direction}`;
}
