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

export interface QuizQuestion {
  direction: QuizDirection;
  prompt: string;
  choices: QuizChoice[];
}
