import type { Rule } from 'eslint';
import { isTodoComment, ticketRefPattern } from './ticket-ref-pattern.js';

export const noTicketRefsInComments: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow epic/story/ADR/ticket references in code comments — see RULES.md',
    },
    messages: {
      ticketRef:
        'Comment references a ticket ID ("{{match}}") — comments must stand alone without referencing the epic/story/ADR that produced them (see RULES.md).',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(): void {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isTodoComment(comment.value)) {
            continue;
          }
          const match = ticketRefPattern().exec(comment.value);
          if (match && comment.loc) {
            context.report({
              loc: comment.loc,
              messageId: 'ticketRef',
              data: { match: match[0] },
            });
          }
        }
      },
    };
  },
};
