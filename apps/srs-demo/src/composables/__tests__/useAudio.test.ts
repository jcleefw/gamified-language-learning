import { describe, it, expect } from 'vitest';
import type { AppDeckPayload } from '@gll/api-contract';
import { resolveSentenceAudio } from '../useAudio';

function makeDeck(overrides: Partial<AppDeckPayload> = {}): AppDeckPayload {
  return {
    id: 'deck-1',
    topic: 'Topic',
    words: [],
    lines: [],
    audioUrl: 'https://cdn.example/deck-1.mp3',
    ...overrides,
  };
}

describe('resolveSentenceAudio (playback ADR §5, §6)', () => {
  it('resolves url/start/end for a fully-marked sentence', () => {
    const decks = [
      makeDeck({
        lines: [
          {
            sentenceId: 's1',
            speaker: 'A',
            native: 'n',
            romanization: 'r',
            english: 'e',
            wordIds: [],
            audioStart: 1.5,
            audioEnd: 3.2,
          },
        ],
      }),
    ];
    expect(resolveSentenceAudio(decks, 's1')).toEqual({
      url: 'https://cdn.example/deck-1.mp3',
      start: 1.5,
      end: 3.2,
    });
  });

  it('returns null for a sentenceId absent from all decks', () => {
    const decks = [makeDeck({ lines: [] })];
    expect(resolveSentenceAudio(decks, 'unknown')).toBeNull();
  });

  it('returns null when the deck has no audioUrl', () => {
    const decks = [
      makeDeck({
        audioUrl: undefined,
        lines: [
          {
            sentenceId: 's1',
            speaker: 'A',
            native: 'n',
            romanization: 'r',
            english: 'e',
            wordIds: [],
            audioStart: 0,
            audioEnd: 1,
          },
        ],
      }),
    ];
    expect(resolveSentenceAudio(decks, 's1')).toBeNull();
  });

  it('returns null for a half-marker (only start, or only end)', () => {
    const decks = [
      makeDeck({
        lines: [
          {
            sentenceId: 's1',
            speaker: 'A',
            native: 'n',
            romanization: 'r',
            english: 'e',
            wordIds: [],
            audioStart: 1.0,
            // audioEnd absent
          },
          {
            sentenceId: 's2',
            speaker: 'A',
            native: 'n',
            romanization: 'r',
            english: 'e',
            wordIds: [],
            // audioStart absent
            audioEnd: 2.0,
          },
        ],
      }),
    ];
    expect(resolveSentenceAudio(decks, 's1')).toBeNull();
    expect(resolveSentenceAudio(decks, 's2')).toBeNull();
  });

  it('returns null for a sentence with no markers at all', () => {
    const decks = [
      makeDeck({
        lines: [
          {
            sentenceId: 's1',
            speaker: 'A',
            native: 'n',
            romanization: 'r',
            english: 'e',
            wordIds: [],
          },
        ],
      }),
    ];
    expect(resolveSentenceAudio(decks, 's1')).toBeNull();
  });
});
