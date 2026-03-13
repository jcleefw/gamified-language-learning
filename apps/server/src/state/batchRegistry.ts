import type { QuizQuestion } from '@gll/api-contract';

const registry = new Map<string, QuizQuestion[]>();

export function register(batchId: string, questions: QuizQuestion[]): void {
  registry.set(batchId, questions);
}

export function get(batchId: string): QuizQuestion[] | undefined {
  return registry.get(batchId);
}

/** Test helper — clears all registered batches. */
export function clearRegistry(): void {
  registry.clear();
}
