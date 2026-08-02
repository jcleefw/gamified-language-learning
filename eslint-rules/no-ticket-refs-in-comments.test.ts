import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { noTicketRefsInComments } from './no-ticket-refs-in-comments.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('no-ticket-refs-in-comments', noTicketRefsInComments, {
  valid: [
    '// packages/logger and packages/shared-utils are leaf packages by construction',
    '// See RULES.md for the comment style guide',
    '// TODO: EP18: this is exempt here — see todo-ticket-refs-in-comments instead',
  ],
  invalid: [
    {
      code: '// EP18: leaf package rule',
      errors: [{ messageId: 'ticketRef', data: { match: 'EP18' } }],
    },
    {
      code: '// EP18-ST05: leaf package rule',
      errors: [{ messageId: 'ticketRef', data: { match: 'EP18-ST05' } }],
    },
    {
      code: '/* ADR-07 explains the drizzle-vs-knex trade-off */',
      errors: [{ messageId: 'ticketRef', data: { match: 'ADR-07' } }],
    },
    {
      code: '// fixes BUG42 for good',
      errors: [{ messageId: 'ticketRef', data: { match: 'BUG42' } }],
    },
  ],
});
