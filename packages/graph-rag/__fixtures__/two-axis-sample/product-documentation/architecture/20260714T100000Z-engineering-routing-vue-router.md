# ADR: Routing via Vue Router 4

**Status:** Accepted

**Date:** 2026-07-14

**Deciders:** PO (solo founder)

**Scope:** How the srs-demo app navigates between screens.

**Decides:** apps/srs-demo#Routing

---

## Context

Screen-string routing had grown unwieldy as the number of screens increased.

## Decision

Adopt Vue Router 4 with lazy-loaded routes, one per screen, and a nav guard for
the confirm/flush/finalize sequence.
