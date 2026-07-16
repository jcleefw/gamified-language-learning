---
name: comment-rewrite
description: 'Rewrites comments in a file or diff: JSDoc for docstrings, strip refactor/story narration. Use after a refactor or before commit.'
tools: Read, Edit, Grep, Glob
---

# Comment Rewrite

Comments only — never change logic. Convention: [RULES.md §3](../../../../RULES.md#3-self-documenting-code). Format template and examples: [docs/code-standards-examples.md](../../../../docs/code-standards-examples.md#docstrings-vs-overloading-comments).

## Steps

1. **Target**: the current diff (`git diff`) unless the user names a specific file or scope.
2. **Classify** each comment:
   - **Docstring** — describes what the function/type does *now*. Keep, reformat as JSDoc (`/** */` with `@param`/`@returns`), placed directly above the declaration.
   - **Overloading comment** — narrates the refactor, a prior version, or a story/PR ("mirrors old X", "see EP##-ST##"). Delete outright — don't compress it, since there's no docstring left once the history is stripped out.
   - **Non-obvious behavior note** — a short, self-contained domain/workaround note with no reference to prior code. Leave as-is.
3. **Test**: would the comment still make sense to someone with no knowledge of the prior code or diff? If not, cut it.
4. **Show** the before/after diff for every changed comment so nothing behavioral is mistaken for a comment edit.
