# decomposer-graph (spike)

A TypeScript port of the Thai *decomposer → typed graph* spike, with a small
React front end. **No Tailwind** — styling is CSS Modules over a CSS-variable
theme (`src/ui/theme.css`, light/dark).

## Shape

```
data/                 authored corpus + fixed foundation (JSON)
  foundation.json       fixed lookup tables (classes, finals, marks, tone labels)
  words.json            authored poem vocabulary
src/core/             pure, framework-free logic (the deliverable)
  types.ts              domain types
  foundation.ts         typed foundation lookups
  decomposer.ts         computeTone / decompose / buildGraph
  graph.ts              GraphReader — neighbours, relatedWords, findPath
  index.ts              loadGraphReader() builds the graph from words.json
src/ui/               React renderer — a "dumb reader" of nodes + edges
  theme.css             CSS variables + light/dark (global)
  global.css            reset + page shell (global)
  *.module.css          component-scoped styles
scripts/build-graph.ts  emits graph.json (the artifact a Graph-RAG step consumes)
```

The renderer knows only *nodes* and *typed edges*. All Thai lives in `src/core`.

## Run

```bash
pnpm --filter @gll/decomposer-graph dev          # vite dev server
pnpm --filter @gll/decomposer-graph build        # typecheck + production build
pnpm --filter @gll/decomposer-graph test         # core unit tests
pnpm --filter @gll/decomposer-graph build:graph  # write graph.json
```

Theme resolution: `:root` (dark) → OS preference → explicit `data-theme`
override (the ◐ button). Edge thickness encodes signal: `-log2(wordsCovered/corpus)`.
