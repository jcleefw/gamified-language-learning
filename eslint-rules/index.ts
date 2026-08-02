import { noTicketRefsInComments } from './no-ticket-refs-in-comments.js';
import { todoTicketRefsInComments } from './todo-ticket-refs-in-comments.js';

// This repo's own custom ESLint rules, keyed by name under the `local/` plugin
// namespace referenced from eslint.config.ts.
export const localRules = {
  'no-ticket-refs-in-comments': noTicketRefsInComments,
  'todo-ticket-refs-in-comments': todoTicketRefsInComments,
};
