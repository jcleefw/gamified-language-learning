import { describe, it, expect } from 'vitest';
import { transformConversation } from '../transform-conversation';
import type { ConversationJSON } from '@gll/api-contract';

const sampleConv: ConversationJSON = {
  topic: "let's eat something",
  difficulty: 'beginner',
  register: 'informal',
  lines: [
    { speaker: 'A', thai: 'หิวแล้ว', english: "I'm hungry", romanization: 'lines-romanization-A' },
    { speaker: 'B', thai: 'ไปกิน',   english: "Let's eat",  romanization: 'lines-romanization-B' },
  ],
  breakdown: [
    {
      thai: 'หิวแล้ว',
      romanization: 'hǐw lɛ́ɛo',
      english: "I'm hungry",
      components: [
        { thai: 'หิว',   romanization: 'hǐw',   english: 'hungry',  type: 'adjective' },
        { thai: 'แล้ว', romanization: 'lɛ́ɛo', english: 'already', type: 'particle'  },
      ],
    },
    {
      thai: 'ไปกิน',
      romanization: 'bpai gin',
      english: "Let's eat",
      components: [
        { thai: 'ไป',  romanization: 'bpai', english: 'to go',  type: 'verb' },
        { thai: 'กิน', romanization: 'gin',  english: 'to eat', type: 'verb' },
      ],
    },
  ],
};

describe('transformConversation', () => {
  it('carries through topic, difficulty, register', () => {
    const deck = transformConversation(sampleConv);
    expect(deck.topic).toBe("let's eat something");
    expect(deck.difficulty).toBe('beginner');
    expect(deck.register).toBe('informal');
  });

  it('maps lines[i].speaker to AppDeck.lines[i].speaker', () => {
    const deck = transformConversation(sampleConv);
    expect(deck.lines[0].speaker).toBe('A');
    expect(deck.lines[1].speaker).toBe('B');
  });

  it('uses breakdown[i].romanization (not lines[i].romanization)', () => {
    const deck = transformConversation(sampleConv);
    expect(deck.lines[0].romanization).toBe('hǐw lɛ́ɛo');
    expect(deck.lines[1].romanization).toBe('bpai gin');
  });

  it('maps breakdown[i].components to AppDeck.lines[i].words', () => {
    const deck = transformConversation(sampleConv);
    expect(deck.lines[0].words).toHaveLength(2);
    expect(deck.lines[0].words[0]).toMatchObject({
      native: 'หิว',
      romanization: 'hǐw',
      english: 'hungry',
      type: 'adjective',
      language: 'th',
    });
    expect(deck.lines[0].words[1]).toMatchObject({
      native: 'แล้ว',
      romanization: 'lɛ́ɛo',
      english: 'already',
      type: 'particle',
      language: 'th',
    });
  });

  it('produces one AppLine per breakdown entry', () => {
    const deck = transformConversation(sampleConv);
    expect(deck.lines).toHaveLength(2);
  });
});
