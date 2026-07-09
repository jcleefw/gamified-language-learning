# Blocked Items — EP36 SRS Review Phase

---

## Current blockers

_None._ EP36 is Impl-Complete for PH01–PH03. PH04 (`srs-demo` Review mode) was spun out to
**`EP37--srs-review-in-srs-demo`**; its blockers (authority + integrity ADR, pending design
discussion) live in that branch's `blocked-items.md`.

---

## Unblocking history

- **PH03 build gotcha (resolved)**: `@gll/db` / `@gll/srs-review` are consumed as built `dist/`;
  DS02's dist was stale (missing `SqliteReviewStore`). Rebuilt both. Future consumers must rebuild
  after DS01/DS02 source changes.
