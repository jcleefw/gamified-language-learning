import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { todoTicketRefsInComments } from './todo-ticket-refs-in-comments.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('todo-ticket-refs-in-comments', todoTicketRefsInComments, {
  valid: [
    '// TODO: rewrite this without a ticket reference',
    '// EP18: not a TODO, so this rule ignores it (handled by no-ticket-refs-in-comments)',
  ],
  invalid: [
    {
      code: '// TODO: EP18: leaf package rule',
      errors: [{ messageId: 'todoTicketRef', data: { match: 'EP18' } }],
    },
    {
      code: '// TODO:EP18-ST05 fix the leak',
      errors: [{ messageId: 'todoTicketRef', data: { match: 'EP18-ST05' } }],
    },
  ],
});
