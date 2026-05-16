# srs-demo

A minimal Vue 3 webapp that runs the `@gll/srs-engine-v2` spaced-repetition quiz loop in the browser.

## Quick start

From the **monorepo root**:

```bash
# 1. Install dependencies (if not already done)
pnpm install

# 2. Build the engine (required before first run)
pnpm --filter @gll/srs-engine-v2 build

# 3. Start the dev server
pnpm --filter srs-demo dev
```

Open [http://localhost:5173](http://localhost:5173).

## What it does

1. **Deck Select** — pick a Thai vocabulary deck (eating or weather)
2. **Quiz** — answer up to 8 multiple-choice questions per batch (native ↔ English ↔ romanization)
3. **Results** — see per-word mastery after each batch; mastered words retire from the active pool
4. **Persistence** — session state is saved to `localStorage` on every batch; reload the page to resume

## Other commands

```bash
# Type-check only
pnpm --filter srs-demo typecheck

# Production build
pnpm --filter srs-demo build
```
