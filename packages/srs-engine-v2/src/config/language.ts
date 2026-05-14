export type WordJoin = 'space' | 'no-space';

export interface LanguageConfig {
  wordJoin: WordJoin;
}

export const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  th: { wordJoin: 'no-space' },
  ja: { wordJoin: 'no-space' },
  zh: { wordJoin: 'no-space' },
  ko: { wordJoin: 'no-space' },
  en: { wordJoin: 'space'    },
};
