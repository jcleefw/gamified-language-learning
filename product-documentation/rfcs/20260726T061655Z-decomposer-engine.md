# RFC: Decomposer Engine — Deterministic Word Breakdown over a Fixed Linguistic Graph

**Created**: 2026-07-26

**Status**: Draft

<!-- Status: Draft | Proposed | Accepted | Rejected | Withdrawn | Shelved | Superseded -->

**Author**: JC Lee / PO

**Supersedes**: N/A

---

> This RFC is a **discussion document**, not a proposal to accept as-is. The pedagogical thesis lives in
> `product-documentation/ideas/20260726T061655Z-graph-decomposable-breakdowns.md`. Here we work through *how* to build
> it — and, more importantly, *whether and where* it belongs. The Open Questions section is the point; the Decision
> section is intentionally empty until we have talked through them.

## Problem Statement

A learner meets Thai words in the wild and cannot see *why* they sound and mean what they do — tone is an invisible
interaction of consonant class, vowel length, tone mark, and syllable shape, in a spaceless abugida. We want a
**decomposer**: given a word, parse it into a path through a fixed "foundation" graph and surface the fired rule, so
each real-life word becomes a grounded, correct-by-construction lesson.

The architectural question this RFC must settle: **what is the smallest, most honest thing we can build that produces
a trustworthy breakdown**, and where does it live relative to the existing engine (`@gll/srs-engine`) and persistence
(`@gll/db`) — without importing the failure mode (LLM-guessed tones) the idea explicitly rejects.

Two framings must be kept apart because they drive different architectures:

- **The graph** — a fixed, finite rule structure (44 consonants→class, ~30 vowels→length, 4 tone marks, the tone
  table, syllable-type rules). Traversal is deterministic and 100% correct.
- **"Graph RAG"** — retrieval over a graph feeding an LLM that *generates*. For the deterministic core this is the
  **wrong tool**: it reintroduces hallucination into the one place errors are invisible to a beginner. Graph RAG is
  reserved (if at all) for the generative periphery (why-this-classifier, related words), grounded in the graph.

**We are proposing to keep the graph and drop the RAG for the core.** The decomposer is a parser + traversal, not a
generator.

## Proposed Solution

A pure-logic package — provisionally `@gll/decomposer-engine` — mirroring the `@gll/srs-engine` archetype:
pure functions, **no I/O, no persistence, empty runtime `dependencies`**, consumed by apps and by `@gll/db` (never the
reverse). Persistence, if any, lives in `@gll/db`; any LLM/renderer lives in the app layer, never in the engine.

Core surface (illustrative):

```ts
decompose(word: string, opts?: { lang: 'th'; rulesetVersion?: string }): DecompositionResult

type DecompositionResult = {
  word: string;
  wordId?: string;                 // th::form::type when identity known
  syllables: SyllableBreakdown[];  // ordered
  status: 'clean' | 'partial' | 'exception';  // did it fully decompose?
  rulesetVersion: string;          // which fixed ruleset produced this
};

type SyllableBreakdown = {
  graphemes: Grapheme[];           // consonant(s), vowel, final, tone mark, silent markers
  initialClass: 'high' | 'mid' | 'low';
  syllableType: 'live' | 'dead';
  toneMark: ToneMark | null;
  firedRule: ToneRuleRef;          // the node the learner couldn't see
  tone: Tone;                      // computed, never guessed
  romanization: string;
  gloss?: string;                  // looked up, may be absent
};
```

**The tone computation is a pure function** `f(class, toneMark, syllableType) → tone` — the crown jewel, and the
*easy* part. **Syllabification and grapheme-cluster reordering are the hard part** (spaceless text; pre-posed vowels
`เ แ โ ใ ไ` stored before their consonant). With the stack fixed to TypeScript (OQ-B resolved), TS owns this step at
runtime — OQ-I is now the real open problem.

The foundation is **not greenfield**: `mockConsonants` already carries `class`, and `foundational_words` already
exists in `@gll/db`. The engine extends this with the vowel inventory, tone marks, and the tone table — data the repo
does not yet model.

Layering:

```
[form / chat input]  → app layer (Nuxt) or CLI demo
        ↓ word
[ @gll/decomposer-engine ]  pure: parse → classify → compute tone → emit path   (+ foundation tables)
        ↓ DecompositionResult
[ renderer ]  template (default) OR grounded LLM (app layer only, optional)      → human explanation
        ↓
[ @gll/db ]  persist result and/or ruleset version (if we cache at all — see OQ-E/OQ-G)
```

## Alternatives Considered

Each row is a real fork we need to pick, not a strawman. Recommendations are leans, not decisions.

### Stack for the engine (OQ-B) — **RESOLVED: TypeScript**

Decided during discussion (2026-07-26). The engine is a pure TS `@gll/` package, per the `srs-engine` archetype.
Python/PyThaiNLP is explicitly **out of scope for the repo** — it is at most a *personal, offline data-sourcing tool*
the author may run on their own machine (like consulting a dictionary). Anything it produces enters the repo as plain
checked-in JSON, indistinguishable from hand-authored data; the repo carries no Python dependency, package, or service.

Consequence carried forward: because Python is not in the runtime, **TS owns syllabification** for any live word not
already in precomputed data. That lands on OQ-I.

### Graph representation (OQ-D)

| Alternative | Pros | Cons |
| --- | --- | --- |
| **Typed in-memory TS data + traversal fns** (lean) | The graph is tiny and fixed (~44+30+4 nodes); matches how `mockConsonants` is already modelled; zero infra; trivially testable | Not a "real" graph engine — multi-hop semantic queries at scale would need more later |
| **Lightweight JSON node/edge file** | Precedent exists (`graph-rag/.graph-data.json`); portable, inspectable | Hand-maintaining edges is error-prone; still need traversal code |
| **Graph DB (Neo4j / Kùzu / SQLite-graph)** | Real multi-hop queries, path algorithms | Massive overkill for a fixed rule table; new infra + ops; only justified if the *semantic* layer grows large |
| **Build a flexible standalone graph library** | Reusable, general | Yak-shave — we do not need generality; the domain fits typed data |

### Where decomposition runs (OQ-N — couples with OQ-B)

| Alternative | Pros | Cons |
| --- | --- | --- |
| **Authoring-time batch** over known curriculum words | Can use best (Python) tooling freely offline; store results; runtime never decomposes | Does not serve the "type any word you saw" use case the idea envisions |
| **Live runtime** on arbitrary user input | Serves the real product vision (form/chat input) | Needs the hard segmenter in the runtime stack (TS or a service) |
| **Hybrid** (lean) | Precompute curriculum offline; decompose live for arbitrary input with a bounded runtime segmenter | Two code paths to keep consistent under one ruleset version |

## Impact

- **Affected areas**: new package (`@gll/decomposer-engine`); extension of foundational data (`mockConsonants`,
  `foundational_words`); possible new store + schema in `@gll/db`; optional new UI surface (input form) in the Nuxt app;
  optional renderer in the app layer.
- **Migration effort**: **low** for a standalone read-only engine + foundation data; **medium** if we persist
  decompositions and later change the ruleset (invalidation/recompute — see OQ-G).
- **Breaking changes**: none expected — additive. Must **not** touch the existing `packages/graph-rag`
  (codebase-knowledge graph) beyond avoiding the name.

## Open Questions

The listed a–e, expanded, plus the ones that surfaced while writing this up. Ordered roughly by how much they gate the others.

**OQ-A — Is this suitable for *this* repo at all?**
For: it directly serves the app's mission, reuses existing foundational data and the engine archetype, and stays LLM-agnostic (the repo's stated value). Against: it is arguably a *second* domain engine, and the semantic layer risks scope creep into an NLP project. *Lean: yes for the deterministic core as a small engine; treat the semantic/LLM periphery as a separate, later gate.* Decision needed: do we commit only to Layer 1 now?
*Evidence (spike, 2026-07-26):* `spikes/decomposer-graph` and the PyThaiNLP/LLM cross-check tests (`product-documentation/spikes/20260726T061655Z-pythainlp-syllable-findings.md`) show the Layer 1/Layer 2 split holding up in practice — tone computation stayed untouched by any LLM involvement throughout; all LLM-adjacent risk showed up only at the periphery (gloss sourcing, sentence segmentation). Supports the lean as-is.

**OQ-B — Python or TS? — RESOLVED: TypeScript** (2026-07-26)
The deterministic core is trivial in TS. Python's only real advantage is Thai NLP tooling (chiefly syllabification),
and that advantage is capturable *offline* — so it does not justify a repo dependency. **Decision: the engine is
TypeScript; PyThaiNLP is out of scope for the repo**, usable only as a personal offline tool whose output arrives as
static JSON. See the resolved Alternatives note above. The remaining live question moves to OQ-I (TS-owned segmentation).
*Evidence:* tested for real, not just asserted — PyThaiNLP installed and run in a disposable venv, output exported as findings/data, zero Python dependency added to the repo. The boundary holds in practice. See findings doc above.

**OQ-C — Same concept as srs-engine, as a `decomposer-engine`?**
*Lean: yes.* Mirror the archetype exactly — pure functions, zero runtime deps, no I/O, plain-function callbacks, 3-level `docs/`, persistence pushed to `@gll/db`. This is the cleanest fit and the RULES.md discipline already exists to copy. Open sub-question: is it one engine or does the *foundation data* deserve its own package shared by both srs-engine and decomposer-engine (today the consonants live as `mockConsonants` inside srs-engine)?

**OQ-D — Build a flexible standalone graph library, or use the market?**
*Lean: neither — model the fixed foundation as typed in-memory TS data + traversal functions*, exactly like `mockConsonants`. The graph is small and static; a general library or a graph DB is unjustified now. Revisit a real graph store **only if** the semantic layer (Layer 2) grows to need multi-hop queries at scale. Note the existing lightweight `graph-rag/.graph-data.json` as precedent for "a graph can just be a typed structure here."
*Evidence:* built, not just leaned on. `spikes/decomposer-graph/src/core/decomposer.ts`'s `buildGraph()` implements exactly this — plain `Map`-backed nodes/edges over 54 words, no DB, fast and trivially inspectable. Confirms in-memory typed data suffices at this scale.

**OQ-E — How does decomposer output get stored permanently?**
Options: (1) **don't store** — recompute on demand (decomposition is deterministic and cheap); (2) **cache the path** in a new `@gll/db` store/table keyed by `wordId` + `rulesetVersion`; (3) store only the **ruleset version** per word and recompute (mirrors the `answer_events` "replay under the config it used" pattern — `ResolvedThresholds`). *Lean: (1) for live input, (2) only for curriculum words that back review items, always tagged with `rulesetVersion`.* Ties to OQ-G.

**OQ-F — Naming.** `graph-rag` is taken by the codebase-knowledge graph. Candidates: `decomposer-engine`, `linguistic-graph`, `script-engine`, `word-breakdown`. *Lean: `decomposer-engine`* (says what it does, matches `srs-engine`). Decision needed to avoid a confusing collision. *Note:* the spike itself is named `decomposer-graph`, outside this candidate list — fine since it's explicitly throwaway (see its own spike plan's non-goals), but it doesn't resolve this naming question for the real package.

**OQ-G — Recompute vs. cache, and ruleset versioning.**
The rules are fixed, but our *encoding* of them will have bugs and coverage gaps. If we persist decompositions, a rule fix must invalidate stale rows. *Lean: version the ruleset (`rulesetVersion`), store it alongside any cached path, treat decomposition as reproducible-from-version.* This is the same replay-safety property `answer_events` already relies on.
*Evidence:* `spikes/decomposer-graph/src/core/foundation.ts` already exports a `RULESET_VERSION` constant threaded through `decompose()`'s output — exercises this pattern end-to-end even in the throwaway spike.

**OQ-H — Scope: does the engine own only the deterministic core, or also the semantic layer?**
Layer 1 (script→class→syllable→tone) is deterministic and belongs in the engine. Layer 2 (gloss, classifier, synonyms, "why") is lookup + generation and does **not** belong in a pure engine. *Lean: engine owns Layer 1 only; glosses are a lookup the app/db provide; Layer 2 generation is a separate, later concern.* This keeps the engine pure and the trust boundary clean.
*Evidence:* the gloss/romanization investigation (findings doc) sharpens this split further — romanization turns out to be *computable*, belonging in Layer 1 alongside tone (same structural inputs, no dictionary needed); gloss stays genuinely Layer 2, and testing showed even a real, non-generative dictionary source (PyThaiNLP's WordNet integration) can return noisy/wrong senses — Layer 2 needs human curation regardless of whether an LLM is involved.

**OQ-I — Syllabification & grapheme-cluster handling — the real hard part (now the top open question).**
With OQ-B resolved to TS, the engine must handle spaceless multi-syllable words and pre-posed vowels *in TypeScript*.
Options: (a) port the rule-based TCC (Thai Character Cluster) regex for grapheme clustering — deterministic, no ML,
portable; (b) add a rule-based TS syllabifier for common cases; (c) use `Intl.Segmenter('th', …)` (ICU, built into
Node) for word-ish breaks; (d) restrict live input to single/short words at MVP and lean on **externally precomputed
JSON** (author's offline PyThaiNLP runs, checked in as data) for curriculum. *Lean: (a)+(b) for the runtime core,
(d) for curriculum coverage, (c) evaluated as a fallback.* Needs a spike to size the accuracy gap of a rule-based TS
syllabifier vs. the offline gold data.
*Evidence (spike, 2026-07-26):* see `product-documentation/spikes/20260726T061655Z-pythainlp-syllable-findings.md`. PyThaiNLP's dictionary-based `syllable_tokenize` matched 5/5 multi-syllable corpus words — validates option (d)'s offline-precompute path for the common case. Confirmed the implicit-vowel residual (ขนม-style) is real even against the genuine tool, not an artifact of a naive approach — that class of word still needs explicit exception-flagging, not a rule. The grapheme-*role* decomposition within a syllable (option (a)/(b)) is still unbuilt — `decompose()` in the spike consumes hand-authored `RawSyllable` fields rather than computing them from a raw string; that's the next concrete build step, planned in `product-documentation/spikes/20260726T134010Z-grapheme-decomposer-and-live-input-spike.md`.

**OQ-J — Exception & failure handling.**
Loanwords, การันต์ (silent consonants), ห/อ นำ (leading consonants), clusters, irregular tones. The engine must **detect and flag** (`status: 'exception' | 'partial'`) rather than force a wrong path. The set of un-decomposable words is a *product signal* (curriculum gaps), not just an error. Needs: a defined taxonomy of exception types and how the UI surfaces "this one is irregular, here's why."
*Evidence:* the sentence-level cross-check tests produced concrete, real examples of exactly these categories — `ชะโลม` (a compound missing from the reference dictionary, fragmenting into two individually-valid-but-wrong pieces) and `เศร้าโศกศัลย์` (a genuine multi-way ambiguous compound where two independent tools disagreed with each other). Both documented in the findings doc as real test cases, not hypotheticals — useful seed material for the exception taxonomy this OQ calls for.

**OQ-K — Relationship to existing foundational data & identity.**
Extend `mockConsonants` / `foundational_words` in place, or introduce a richer foundation model (vowels, tone marks, rules) that supersedes them? And decomposition attaches to `th::form::type` identity — confirm the engine consumes that scheme rather than inventing its own. *Lean: promote foundation data to a shared source of truth; consume the existing identity scheme.*
*Note:* the spike does **not** resolve this — `spikes/decomposer-graph/data/foundation.json` is a standalone foundation table, deliberately isolated from `packages/@gll/*` per the spike's own non-goals, and doesn't reuse `mockConsonants`/`foundational_words` at all. This question is exactly as open as before; the spike only proves the *shape* of a foundation table works, not which foundation table the real engine should consume.

**OQ-L — Where does the renderer / LLM live?**
Out of the engine, always (purity). Template renderer first; grounded LLM optional in the app layer. Confirm we are comfortable that the core ships with **no LLM at all** at MVP.
*Evidence:* the sentence-segmentation cross-check tests are a concrete existence proof of this boundary holding under real use — an LLM proposing/adjudicating word *boundaries* (never tone) was tested across 5 sentences with mixed but bounded results (findings doc), always reviewable/overridable rather than trusted outright. Confirms LLM involvement can be confined to the periphery in practice, provided disagreements are surfaced rather than silently resolved in the LLM's favor.

**OQ-M — Data source & licensing for glosses.**
Wiktionary / RTSD / LEXiTRON have different licenses. If we store glosses, licensing matters. Needs a check before any bulk import.
*Evidence:* `kaikki.org/dictionary/Thai/` verified live — a 17,437-word JSONL Wiktionary extraction (CC BY-SA/GFDL), the most practical concrete candidate found so far. License compatibility with product redistribution still needs an actual check, not yet done. PyThaiNLP's bundled WordNet integration was also tested and rejected as a gloss source — works fully offline but returned noisy/wrong senses (e.g. an inappropriate top sense for น้ำ/water) and English-only definitions.

**OQ-N — Offline curriculum vs. live runtime input.**
The idea envisions a live "type a word you saw" form. The trustworthy, cheap-to-build part is offline batch over known
curriculum (now: externally precomputed JSON, since Python is out of the repo). *Lean: hybrid — ship curriculum
breakdowns from checked-in data first (proves the engine, feeds SRS), add live arbitrary input second once the TS
segmenter question (OQ-I) is settled.* Note: with OQ-B resolved, "offline" no longer implies any repo toolchain — it is
just data authoring.
*Evidence:* the live-arbitrary-input path was stress-tested directly — 5 sentences segmented by an LLM and cross-checked against PyThaiNLP's dictionary segmenter (findings doc). Result: mostly clean agreement, but with real, non-hypothetical failure cases on both sides (LLM under-fusion; dictionary mis-fragmentation on an OOV compound; two dictionary engines disagreeing with each other on a genuinely ambiguous compound). Confirms live input is *reachable* but needs a diff-and-adjudicate architecture, not a single trusted source — still supports shipping curriculum-first before live input.

## Decision

<!-- Filled in when status changes to Accepted/Rejected -->

**Decision**: {pending discussion}
**Rationale**: {tbd}
**Next step**: {tbd — likely a spike on OQ-I/OQ-N, then an ADR for the accepted shape}
