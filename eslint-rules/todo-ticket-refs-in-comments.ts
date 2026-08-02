import type { Rule } from 'eslint';
import { isTodoComment, ticketRefPattern } from './ticket-ref-pattern.js';

// A TODO comment legitimately needs to name the ticket that will resolve it —
// it's a forward-looking pointer, not after-the-fact narration. This rule is
// therefore configured 'warn' only in eslint.config.ts and must stay that
// way even if no-ticket-refs-in-comments is ever escalated to 'error'.
export const todoTicketRefsInComments: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'flag (never error) ticket references inside TODO comments — see RULES.md',
    },
    messages: {
      todoTicketRef:
        'TODO references a ticket ID ("{{match}}") — allowed, but keep this at warn severity so a stale TODO never fails a build (see RULES.md).',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(): void {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!isTodoComment(comment.value)) {
            continue;
          }
          const match = ticketRefPattern().exec(comment.value);
          if (match && comment.loc) {
            context.report({
              loc: comment.loc,
              messageId: 'todoTicketRef',
              data: { match: match[0] },
            });
          }
        }
      },
    };
  },
};
