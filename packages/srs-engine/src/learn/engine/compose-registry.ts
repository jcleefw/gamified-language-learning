import type { QuizQuestion } from '../types/quiz.js';

export interface ComposerRegistry {
  add(thunk: () => QuizQuestion[]): void;
}

interface RegistryWithThunks extends ComposerRegistry {
  readonly thunks: ReadonlyArray<() => QuizQuestion[]>;
}

export function createComposerRegistry(): RegistryWithThunks {
  const thunks: Array<() => QuizQuestion[]> = [];
  return {
    add(thunk) { thunks.push(thunk); },
    get thunks() { return thunks; },
  };
}

export function assembleBatchQuestions(registry: RegistryWithThunks): QuizQuestion[] {
  return registry.thunks.flatMap(t => t());
}
