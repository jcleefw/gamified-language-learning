import type { QuizQuestion } from '@gll/api-contract';

export interface BatchEntry {
  questions: QuizQuestion[];
  correctKeys: Record<string, string>;
}

const registry = new Map<string, BatchEntry>();

export function register(batchId: string, entry: BatchEntry): void {
  registry.set(batchId, entry);
}

export function get(batchId: string): BatchEntry | undefined {
  return registry.get(batchId);
}

/** Test helper — clears all registered batches. */
export function clearRegistry(): void {
  registry.clear();
}
