# Spike Plan — Grapheme-Role Decomposer + Live Word/Sentence Input

**Created**: 2026-07-26
**Status**: Slices 1–3 complete, stop for review (Slices 4–5 start next session)
**Author**: JC Lee / PO
**Relates to**: RFC `20260726T061655Z-decomposer-engine.md` (OQ-I, OQ-J, OQ-L, OQ-N), Spike plan
`20260726T061655Z-decomposer-graph-spike.md`, Findings `20260726T061655Z-pythainlp-syllable-findings.md`

---

## Why this is next

The first spike (`spikes/decomposer-graph`) proved the graph/tone half of the pipeline: `computeTone()` is
real, pure, and correct; `buildGraph()` shows in-memory typed data is enough at this scale (OQ-D). But its
`decompose()` consumes **hand-authored** `RawSyllable` fields (`initial`, `clusterConsonant`, `vowel`,
`long`, `final`, `mark`, `leadingSilent`, `silentFinal`) straight from `words.json` — nothing in the spike
actually _computes_ those fields from a raw Thai string. That's the piece this spike plan builds.

Separately, the PyThaiNLP + LLM cross-check tests (findings doc) validated multi-syllable _boundary_-finding
for the common case and mapped where it still needs a human-reviewable fallback. Combined, we now have
enough evidence to attempt the full non-LLM pipeline end to end, plus a bounded, clearly-labeled LLM-assisted
path for free sentence input.

## Goal

1. Build `decomposeGraphemes(syllable: string): RawSyllable` — a rule-based TS parser (leading-vowel
   detection, cluster table, vowel-pattern table, tone-mark diacritics, การันต์, ห/อ นำ) that fits into the
   existing `spikes/decomposer-graph/src/core/` flow, replacing hand-authored syllable fields with computed
   ones.
2. Validate it by re-running over all 54 existing `words.json` entries and diffing the computed fields
   against the hand-authored ground truth — the same rigor already applied to PyThaiNLP's boundary-finding.
3. Add a live-input path so the spike can decompose a **new** word or sentence supplied at runtime, not just
   the fixed 54-word corpus.

## Scope for the two live-input modes

- **Single word / known syllable boundaries** → straight into `decomposeGraphemes()`. For multi-syllable
  words needing boundary-finding first, the boundary source is **static exported data** (from PyThaiNLP's
  `thai_words()` / `syllable_tokenize`, checked in as JSON) — no live Python call, per OQ-B's existing
  boundary. Words outside that static data get flagged `exception`, not guessed.
- **Sentence** → needs word-boundary-finding first, which is the harder problem. Per the findings doc, this
  needs an LLM proposal **diffed against** the same static dictionary data's own segmentation, with any
  disagreement surfaced for review — never one source silently trusted over the other. This path is
  explicitly Layer 2 / periphery (OQ-L, OQ-N): clearly labeled non-deterministic, never blended into the
  Layer 1 output as if computed.

## Non-goals

- Not the real `@gll/decomposer-engine` package — still throwaway, still isolated from `packages/@gll/*`
  (same boundary as the first spike; does not resolve OQ-K).
- No persistence.
- Live LLM wiring for sentence mode is a stretch goal, not a requirement — the 5 sentences already tested in
  the findings doc can stand in as fixture data if wiring a real API call is out of scope for this pass.

## Open questions this spike should settle

- Does the computed grapheme-role parser reach a validation rate on the 54-word corpus comparable to
  PyThaiNLP's 5/5 on boundary-finding? Where does it fall short, and is that shortfall a rule-table gap
  (fixable) or a genuine exception (การันต์, ห/อ นำ, loanword) that should just be flagged?
- What shape should the exported PyThaiNLP-derived static dictionary take for TS consumption (word → syllable
  boundaries; filtered to what size)?
- Is a live LLM call in scope for this spike's sentence-input path, or should it be stubbed with the
  already-tested fixture sentences?

## Build slices (something visible early)

1. Export PyThaiNLP's syllable/word data as static JSON (`thai_words()` + `syllable_tokenize` output),
   scoped to what the spike needs.
2. `decomposeGraphemes(syllable: string): RawSyllable` — the rule tables, built fresh.
3. Validation harness: re-run over all 54 `words.json` entries, diff computed vs. hand-authored fields,
   report per-field accuracy (not just pass/fail per word).
4. Wire the validated parser into the existing `decompose()` / `buildGraph()` flow so at least the
   corpus subset that validates clean is graph-built from _computed_ syllables, not hand-authored ones.
5. Live single-word input: UI entry point → static-dictionary boundary lookup → `decomposeGraphemes()` →
   existing tone computation → graph.
6. (Stretch) Live sentence input: entry point → LLM-proposed segmentation (fixture-backed or live) → diff
   against static dictionary segmentation → surfaced disagreement → per-word decomposition.

## Deliverable

Updated `spikes/decomposer-graph` package: new parser module + a validation report (accuracy against the
54-word corpus, field by field) + a live single-word input path in the existing UI. Sentence input as a
stretch goal, gated on the LLM-wiring decision above.

## Completed (Session 2026-07-27)

**Slice 1** — Skipped per user directive. PyThaiNLP export not needed to validate the parser against the hand-authored corpus.

**Slice 2** — `decomposeGraphemes()` + `composeSyllableText()` built and integrated. All lookup tables (leading vowels, combining vowel signs, consonant clusters, vowel patterns, tone marks, nam targets, thanthakhat) extracted from inline code into `data/foundation.json` per the codebase's established data/logic split. `src/core/foundation.ts` derives typed exports (`LEADING_VOWELS`, `TRUE_CLUSTERS`, `VOWEL_TABLE`, etc.). Pure rule logic (no dictionary/LLM) handles ห/อ นำ, true clusters (8 corpus-exercised only), vowel reductions (◌ัว/◌ือ), explicit การันต์ marked with ์, and correctly flags unmarked silent-final irregularities as exceptions (e.g., เพชร) rather than guessing.

**Slice 3** — Validation harness (`scripts/validate-grapheme-parser.ts`) iterates over all 70 syllables in the hand-authored corpus (now split across 54 words due to multi-syllable words), uses `composeSyllableText()` to derive ground-truth input text per syllable, runs `decomposeGraphemes()` on it, and diffs against authored fields. **Result: 100% per-field accuracy on 69 parsed syllables.** Single exception: เพชร (unmarked-การันต์) correctly flagged, not guessed. 17 unit tests (patterns covering ห นำ, clusters, reductions, marked-การันต์, etc.) all passing.

**Commit**: `0cf02a3` — rule-based Thai grapheme parser, tests, validation script, data/logic refactor (458 insertions).

## Next (Session TBD)

- [ ] Slice 4 — wire computed parser into existing `decompose()` / `buildGraph()` flow
- [ ] Slice 5 — live single-word input UI entry point
- [ ] Slice 6 (stretch) — live sentence input with LLM cross-check
- [x] Slice 7 — computed romanization — **done, 87.7% match vs. authored corpus.** Split out to its
  own spike: `20260727T113226Z-computed-romanization-spike.md` (root cause, plan, scheme, result).
