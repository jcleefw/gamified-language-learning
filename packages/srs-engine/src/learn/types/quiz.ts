export interface WordQuizResult {
  wordId: string;
  correct: boolean;
}

export interface SentenceQuizResult {
  sentenceId: string;
  correct: boolean;
}

export type QuizResult = WordQuizResult | SentenceQuizResult;

export type QuizDirection =
  | 'native-to-english'
  | 'english-to-native'
  | 'native-to-romanization'
  | 'romanization-to-native';

export interface QuizChoice {
  label: 'a' | 'b' | 'c' | 'd';
  value: string;
  isCorrect: boolean;
}

export interface MCQQuestion {
  kind: 'mcq';
  wordId: string;
  direction: QuizDirection;
  prompt: string;
  choices: QuizChoice[];
}

export interface SentenceTile {
  native: string;
  romanization: string;
  english: string;
  wordId: string;
}

export interface SentenceQuestion {
  kind: 'word-block';
  sentenceId: string;
  direction: 'english-to-native' | 'native-to-english' | 'native-to-romanization' | 'romanization-to-native';
  prompt: string;
  tiles: SentenceTile[];
  answer: string[];
}

export type QuizQuestion = MCQQuestion | SentenceQuestion;
