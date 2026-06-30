import type { ConversationJSON, AppDeck, AppLine, AppWord } from '@gll/api-contract';

export function transformConversation(conv: ConversationJSON): AppDeck {
  const lines: AppLine[] = conv.breakdown.map((entry, i) => {
    const speaker = conv.lines[i]?.speaker ?? '';
    const words: AppWord[] = entry.components.map((c) => ({
      native: c.thai,
      romanization: c.romanization,
      english: c.english,
      type: c.type,
      language: 'th',
    }));
    return {
      speaker,
      native: entry.thai,
      romanization: entry.romanization,
      english: entry.english,
      words,
    };
  });

  return {
    topic: conv.topic,
    ...(conv.difficulty !== undefined && { difficulty: conv.difficulty }),
    ...(conv.register !== undefined && { register: conv.register }),
    lines,
  };
}
