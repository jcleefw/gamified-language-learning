# EP24-ST01: Scaffold `apps/srs-demo` Vite + Vue 3 App

**Date**: 20260511T230626Z
**Epic**: EP24 — Vue SRS Demo App
**Story**: EP24-ST01
**Status**: Completed

## What changed

Created the `apps/srs-demo/` package from scratch.

**Files created**:
- `apps/srs-demo/package.json` — `@gll/srs-demo`, deps: `vue@^3.5`, `@gll/srs-engine-v2 workspace:*`; devDeps: `vite@^6`, `@vitejs/plugin-vue@^5`, `vue-tsc@^2`, `typescript@^5.7`
- `apps/srs-demo/vite.config.ts` — Vite config with `@vitejs/plugin-vue`
- `apps/srs-demo/tsconfig.json` — extends `../../tsconfig.base.json`; adds `lib: [ESNext, DOM]`, `esModuleInterop`, `allowSyntheticDefaultImports`, `moduleResolution: bundler`
- `apps/srs-demo/index.html` — mounts `#app`
- `apps/srs-demo/src/main.ts` — `createApp(App).mount('#app')`

**Engine package changes**:
- `packages/srs-engine-v2/package.json` — updated `main`/`types` to `dist/src/index.js` (was `dist/index.js`; dist output path was mismatched); added subpath exports for mock data: `./data/mock/mock-decks`, `./data/mock/mock-words`, `./data/mock/mock-word-pool`, `./data/mock/mock-consonants`
- `packages/srs-engine-v2/tsconfig.build.json` — added `data/**/*` to `include` so mock data compiles alongside `src/**/*`

## Decisions

- `rootDir: "."` in `tsconfig.build.json` with `include: [src/**, data/**]` outputs to `dist/src/` and `dist/data/` — matching the new subpath exports.
- Subpath exports added to the engine rather than importing source `.ts` files directly from the app; keeps the app consuming the compiled package boundary.
