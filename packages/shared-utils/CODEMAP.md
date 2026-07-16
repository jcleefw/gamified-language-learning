# CODEMAP.md — `packages/shared-utils/`

Pure, dependency-free utility functions shared by more than one app. Not a types package, not a domain-logic home.

**Update this file whenever**: files are added, removed, or their exported API changes.

---

## Package Root

| File               | Purpose                                                       |
| ------------------ | -------------------------------------------------------------- |
| `package.json`      | Package manifest — `@gll/shared-utils`, no runtime deps        |
| `tsconfig.json`     | Extends `tsconfig.base.json`; typecheck only                   |
| `tsconfig.build.json` | Build config — `outDir: dist`                                |
| `CODEMAP.md`        | This file                                                       |

---

## `src/`

| File       | Purpose                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------- |
| `index.ts` | Barrel re-export                                                                             |
| `vtt.ts`   | WebVTT timing helpers (moved from `@gll/api-contract` — EP43). Used by `srs-demo` and `server` |

---

## Exports Summary

| Export               | Source   |
| --------------------- | -------- |
| `VttCue`               | `vtt.ts` |
| `secondsToVttTime`     | `vtt.ts` |
| `vttTimeToSeconds`     | `vtt.ts` |
| `buildVtt`             | `vtt.ts` |
| `parseVtt`             | `vtt.ts` |
| `readVttHash`          | `vtt.ts` |
