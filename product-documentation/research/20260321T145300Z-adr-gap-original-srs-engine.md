# Research: Original SRS Engine ADR — Gap Analysis

**Date**: 2026-03-21
**Context**: During the EP21 design session, the original SRS Engine ADR (2026-03-02) was
compared against what EP20 built and what EP21 will build. This document captures the gaps —
mechanics specified in the original ADR that have not been addressed, with a priority
assessment for future epics.

**Source ADR**: [20260302T160536Z-engineering-srs-engine-package.md](../architecture/20260302T160536Z-engineering-srs-engine-package.md)

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Done |
| 🟡 | Partially addressed |
| 🔵 | In scope for EP21 |
| ❌ | Not yet addressed |
| ⚠️ | Active gap — needs resolution before feature is complete |

---

## Full Gap Table

| Feature | Original ADR Spec | EP20 Status | EP21 Status | Priority |
|---|---|---|---|---|
| **Mastery counting** | +1/−1, floor 0, thresholds: 5 foundational / 10 curated | ✅ Built. Streak-based (richer than ±1). Single threshold only. | — | Low — single threshold working; differentiation deferred (OQ3) |
| **Phase transition: Learning → Review** | On mastery threshold | 🟡 EP20 Learning complete; no transition hook | 🔵 EP21 — graduation hook | High |
| **Phase transition: Review → Learning** | On 3 lapses; mastery reset to 0 | ❌ Not designed anywhere | ⚠️ OQ1 — not yet designed | High |
| **FSRS / ANKI scheduling** | ts-fsrs behind abstraction | ❌ Deferred from EP20 | 🔵 EP21 core scope | High |
| **Batch composition priority** | Carry-over → foundational revision → new words → foundational learning | 🟡 Sliding window exists; no explicit carry-over priority queue | 🔵 Partial (write-on-answer unblocks this) | Medium |
| **Question type distribution** | 70% MC / 20% word-block / 10% audio; post-depletion redistribution | ❌ MC only throughout EP20 | ❌ Deferred | Medium |
| **Active window management** | 8-word limit, 4-new-per-batch cap | ✅ EP20 built (`questionLimit` caps pool; sliding entry on mastery) | — | — |
| **Stuck word logic** | No progress after 3 batches → shelved 1 day; max 2 shelved; re-enters as carry-over | ❌ Explicitly deferred in EP20 | ⚠️ OQ4 — deferred | Low |
| **Foundational deck mechanics** | 3 active at a time; continuous wrong (3) → reset; 20% → 5% allocation on depletion | 🟡 Foundational words exist; no special allocation or reset rules | ❌ Deferred | Low |
| **Answer processing / carry-over** | Wrong words carry over to next batch via priority rules | 🟡 Words stay in active implicitly; no explicit carry-over flag | 🔵 Write-on-answer (EP21) moves this forward | Medium |
| **Configuration validation** | Validate config sanity (batch size > 0, thresholds > 0) | ❌ Not built | 🔵 Low priority | Low |
| **Per-word-type mastery thresholds** | 5 foundational, 10 curated | ❌ Single threshold only | ⚠️ OQ3 — deferred | Medium |
| **Max interval cap** | 90 days — prevents words disappearing for months | ❌ Not configured | ✅ FSRS `maximum_interval` param — trivial | Low |
| **Desired retention** | 0.9 configurable | ❌ Not configured | ✅ FSRS `request_retention` param — trivial | Low |
| **Audio unavailability redistribution** | If audio unavailable, redistribute slots to MC/word-block | ❌ Audio not implemented | ❌ Depends on audio question type — deferred | Low |

---

## High Priority Gaps

### 1. Review → Learning re-entry on lapse threshold (EP21 OQ1)

The original ADR specified: **3 lapses in the Review phase → word drops back to Learning;
mastery reset to 0**.

FSRS handles stability decay on `Again` ratings naturally — intervals shrink and the word
appears more frequently. But FSRS will not automatically kick a word back to EP20's Learning
loop. That crossover is an explicit engine rule sitting on top of FSRS.

Without this fallback, a word that a user persistently cannot recall stays in Review forever,
just with very short intervals — never getting the intensive drilling of the Learning phase.

**Questions to resolve before implementing:**

- What is the lapse count threshold? (Original spec: 3 — may need tuning)
- What resets on re-entry? Mastery back to 0, or a specific mid-level (e.g. 2)?
- Does the word re-enter the active Learning pool immediately, or back of queue?
- Does the `ReviewCard` get deleted, archived, or retained for history?
- Does re-entry use the existing `runAdaptiveLoop`, or a dedicated re-drill mode?

### 2. Per-word-type mastery thresholds (EP21 OQ3)

Original spec: foundational words require mastery 5 to graduate; curated words require
mastery 10. EP20 uses a single configurable threshold for all word types.

This was deferred as "premature until the core cycle is validated." At some point it needs
to surface — a new Thai consonant and a common vocabulary word shouldn't have the same
graduation bar. The foundational deck mechanics (below) depend on this.

---

## Medium Priority Gaps

### 3. Batch composition priority ordering

Original spec had a strict priority queue:
1. Carry-over words (wrong from previous batch)
2. Foundational revision (due foundational words)
3. New words (from queue)
4. Foundational learning (new foundational words)

EP20's sliding window doesn't have this explicit prioritisation. Wrong words stay in the
active pool and compete equally with other words in the next batch. This is simpler but
doesn't honour the carry-over guarantee from the original design.

May need revisiting once the Review phase introduces review words potentially competing
with learning words in the same session.

### 4. Question type distribution (70/20/10)

Original spec: 70% MC, 20% word-block, 10% audio in a standard 15-question batch, with
redistribution if audio is unavailable. EP20 is MC only throughout. This requires:

- Word-block question type design and implementation
- Audio question type design and TTS/audio infrastructure
- Distribution logic in `composeBatchMulti`

This is a separate epic-level concern, not just a story.

---

## Low Priority Gaps

### 5. Stuck word shelving

Original spec: if a word shows no measurable progress after 3 batches, shelve it for 1 day.
Maximum 2 shelved concurrently. Re-enters as carry-over.

The Review phase's lapse handling (OQ1) partially addresses this for graduated words. For
Learning-phase stuck words, this is still unaddressed.

### 6. Foundational deck special mechanics

Original spec:
- Max 3 foundational words active simultaneously
- 3 consecutive wrong answers → reset that word (back to start)
- 20% of batch allocated to foundational; drops to 5% after foundational pool is depleted

EP20 has foundational words (consonants) but no special allocation rules or the continuous-
wrong reset. These were explicitly deferred in the EP20 scope statement.

### 7. Audio unavailability redistribution

Depends on audio question types being implemented. If a word has no audio, those question
slots should redistribute to MC or word-block proportionally. Blocked by point 4.

### 8. Configuration validation

Validate that config values passed to the engine are sane (e.g., `questionLimit > 0`,
`masteryThreshold > 0`, thresholds consistent). Low urgency but worth adding once the
config object stabilises across EP20 and EP21 features.

---

## Already Addressed from Original ADR

| Original Feature | How Addressed |
|---|---|
| `ts-fsrs` behind abstraction | `ReviewScheduler` interface in EP21; FSRS isolated to `fsrs-scheduler.ts` |
| Active window management | EP20 `questionLimit` caps active pool; sliding entry on mastery |
| Engine-owned types | All types in `src/types/` — no external type package imports |
| Framework-agnostic, zero I/O | `packages/srs-engine-v2/` — pure TS, no framework or I/O deps |
| Desired retention config | FSRS `request_retention: 0.9` param in `FsrsScheduler` |
| Max interval cap | FSRS `maximum_interval: 90` param in `FsrsScheduler` |
| Semver + changelog | Existing EP changelog structure (`/changelogs/`) |

---

## References

- [Original SRS Engine ADR](../architecture/20260302T160536Z-engineering-srs-engine-package.md)
- [SRS Engine v2 Learning Phase ADR](../architecture/20260319T000000Z-engineering-srs-engine-v2-learning-phase.md)
- [EP20 Epic Plan](../../.agents/plans/epics/EP20-srs-engine-v2-rebuild.md)
- [EP21 Epic Plan](../../.agents/plans/epics/EP21-srs-engine-v2-revision-phase.md)
- [Design Session: EP20 vs FSRS](202603211351000Z-gap-srs-enginev2-vs-fsrs.md)
