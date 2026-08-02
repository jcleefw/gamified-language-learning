export const TICKET_ABBREVIATIONS = 'EP|PH|DS|UX|TP|ST|TA|BUG|CH|RV|ADR|RFC|AGN';

// Every abbreviation from WORKFLOW.md's artifact taxonomy (epic-attached and
// standalone): Epic, Phase, Design Spec, UX Spec, Test Plan, Story, Task, Bug,
// Chore, Review, ADR, RFC, Agentic Plan. Chains on hyphens so a compound ref
// like "EP18-ST05" is captured as one match, not just its first segment.
export function ticketRefPattern(): RegExp {
  return new RegExp(
    `\\b(?:${TICKET_ABBREVIATIONS})-?\\d+(?:-(?:${TICKET_ABBREVIATIONS})-?\\d+)*\\b`,
    'i',
  );
}

const TODO_PREFIX_PATTERN = /^\s*todo\s*:/i;

export function isTodoComment(commentValue: string): boolean {
  return TODO_PREFIX_PATTERN.test(commentValue);
}
