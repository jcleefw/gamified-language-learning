# Coding Practices & Guidelines

## Linting & Type Safety

### Console Statements
- **Rule**: Guard console statements in demo/CLI files with `/* eslint-disable no-console */` at the **top of the file** only if the entire file intentionally uses console logging. Remove unused directives.
- **Why**: Demo code may need logging; production code shouldn't. Keeps intent explicit.

### Variable Declaration
- **Rule**: Use `const` by default. Only use `let` for variables that are reassigned. Never use `var`.
- **Why**: Reduces bugs from accidental reassignment; improves code clarity.

### Unused Variables & Imports
- **Rule**: Remove unused imports and function parameters. If a parameter is intentionally unused, prefix it with `_` (e.g., `_db`). 
- **Why**: Reduces cognitive load; catch bugs early.

### Type Safety
- **Rule**: No `any` types. Specify return types on exported functions, especially in test files.
- **Why**: Provides IDE support and catches errors at compile time.

### Template Literals
- **Rule**: When interpolating numbers in template strings, wrap with `String()` or use the value in arithmetic context first.
- **Why**: Ensures TypeScript's `restrict-template-expressions` rule passes; improves type clarity.

### Non-Null Assertions
- **Rule**: Avoid `!` (non-null assertion) operator. Use type guards or optional chaining (`?.`) instead.
- **Why**: Masks potential runtime errors; TypeScript guards should prove safety before you assert.

### Async/Await
- **Rule**: Only `await` values that are actually Promises. Use `await` consistently or remove it.
- **Why**: Unnecessary `await` signals code confusion; wastes CPU on already-resolved promises.
