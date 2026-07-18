/** Foundational character — language-agnostic base.
 *  Language-specific metadata varies (Thai: class/soundClass/IPA; other langs: TBD). */
export interface FoundationalCharacter {
  id: string;
  char: string;
  name: string;
  romanization: string;
  language: string;
  nameThai?: string;
  type: 'consonant' | 'vowel' | 'tone';
  audioFile?: string;
  metadata?: Record<string, unknown>;
}
