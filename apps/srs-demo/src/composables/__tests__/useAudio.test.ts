import { describe, it, expect } from 'vitest';
import type { AppDeckPayload, AppLinePayload } from '@gll/api-contract';
import { resolveSentenceAudio } from '../useAudio';

function line(sentenceId: string): AppLinePayload {
  return { sentenceId, speaker: 'A', native: 'n', romanization: 'r', english: 'e', wordIds: [] };
}

function makeDeck(overrides: Partial<AppDeckPayload> = {}): AppDeckPayload {
  return {
    id: 'deck-1',
    topic: 'Topic',
    words: [],
    lines: [line('s1')],
    audioUrl: 'https://cdn.example/deck-1/abc.mp3',
    vttUrl: 'https://cdn.example/deck-1/abc.vtt',
    ...overrides,
  };
}

describe('resolveSentenceAudio (playback ADR §5, §6 — deck-level, VTT-driven)', () => {
  it('resolves the deck audioUrl + vttUrl for a sentence in a segmentable deck', () => {
    expect(resolveSentenceAudio([makeDeck()], 's1')).toEqual({
      audioUrl: 'https://cdn.example/deck-1/abc.mp3',
      vttUrl: 'https://cdn.example/deck-1/abc.vtt',
    });
  });

  it('returns null for a sentenceId absent from all decks', () => {
    expect(resolveSentenceAudio([makeDeck({ lines: [] })], 'unknown')).toBeNull();
  });

  it('returns null when the deck has no audioUrl', () => {
    expect(resolveSentenceAudio([makeDeck({ audioUrl: undefined })], 's1')).toBeNull();
  });

  it('returns null when the deck has audio but no vttUrl (not segmentable)', () => {
    expect(resolveSentenceAudio([makeDeck({ vttUrl: undefined })], 's1')).toBeNull();
  });

  it('finds the right deck when a sentence lives in one of several', () => {
    const decks = [
      makeDeck({ id: 'd1', lines: [line('a')], audioUrl: 'u1', vttUrl: 'v1' }),
      makeDeck({ id: 'd2', lines: [line('b')], audioUrl: 'u2', vttUrl: 'v2' }),
    ];
    expect(resolveSentenceAudio(decks, 'b')).toEqual({ audioUrl: 'u2', vttUrl: 'v2' });
  });
});
