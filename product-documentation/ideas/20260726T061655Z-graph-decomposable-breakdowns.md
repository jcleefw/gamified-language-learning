# Idea Brief — Graph-Backed Decomposable Breakdowns for Language Learning

**Created**: 20260726T061655Z
**Source**: exploration conversation on whether a knowledge graph (and/or "Graph RAG") is a good testing ground for learning Thai. This brief captures the *pedagogical thesis* and product shape. The engineering feasibility and package/stack decisions are deliberately split into the companion RFC (`product-documentation/rfcs/20260726T061655Z-decomposer-engine.md`) — this doc records the idea, not the decisions.

---

### Core Idea

A learner constantly meets words "in the wild" — on a sign, a menu, a chat message. For a script like Thai, the word is opaque: no spaces between words, tone determined by an interaction of consonant class + vowel length + tone mark + syllable shape, an abugida where vowels sit before/after/above/below the consonant. The learner can *see* the word but cannot *see why it works*.

The idea: hold the **foundation** of the language as a small, fixed graph (consonants → class, vowels → length, tone marks, the tone rule table), and let a **decomposer** parse any supplied word into a path through that graph — surfacing the *understandable nodes* and, crucially, **the rule that fired**. The output is not "here is the answer," it is "here is the word broken into the pieces you already know, and the reason it sounds and means what it does."

This turns every real-life encounter into a self-contained lesson grounded in the pieces the learner has already met — the same foundational units the SRS engine already tracks (`foundational_words`, `mockConsonants` with `class`).

### The one insight that shapes everything

Language learning splits into two layers, and they demand opposite tools:

1. **Deterministic core** — script decomposition, consonant class, syllable type, tone. This is a *pure function of the letters*. A fixed rule-graph answers it by traversal, 100% correct, forever. An LLM generating here can hallucinate a tone, and a beginner **cannot detect the error** — it gets baked into their pronunciation. So for this layer, the graph strictly dominates; generation only adds risk.

2. **Generative periphery** — *why* a classifier, register nuance, "give me related words," conversational practice. No single traversable answer; synthesis grounded in structure is genuinely useful here. This is the only place an LLM earns its place, and only when grounded by the graph.

**Design consequence:** the decomposition itself is deterministic traversal and must never be generated. Any LLM/renderer is demoted to a *phrasing and linking* layer over facts the graph produced — and for the core, a plain template already reads well enough that the LLM is optional. We keep the **graph** and drop the **RAG** for the part that must be correct.

### What "decompose to understandable nodes" looks like

`ร้าน` (a shop) parses to:

```
ร  → consonant /r/ → class: LOW
า  → vowel /aː/     → LONG
น  → final /n/      → sonorant → syllable: LIVE
◌้  → tone mark: MAI THO
        │
  rule fired: LOW class + MAI THO → HIGH tone
        │
  result: /ráːn/ → "ráan" → shop
```

The node the learner could not see unaided is *the fired rule*. That is the product's whole value.

### Why this could enhance learning

- **Grounds new words in known units.** Every breakdown reuses the foundational nodes the learner is already drilling — reinforcement, not new load.
- **Explains the "why," which flashcards can't.** Tone becomes a derivation, not a fact to memorise.
- **Trustworthy by construction.** The correct-by-traversal core means the tool never silently teaches a wrong tone.
- **Feeds the SRS loop.** A decomposition surfaces the sub-units (consonant, vowel, tone-mark, rule) that could themselves become schedulable review items, and flags which foundational pieces a learner keeps tripping on.
- **Turns "words seen in real life" into curriculum.** The learner supplies the input; the system does the pedagogy.

### Why it might not be worth it (honest risks)

- **The scary part is easy; the trivial-looking part is hard.** Tone/class is a table lookup. *Splitting a spaceless word into syllables* and reordering pre-posed vowels is the real engineering (see RFC).
- **Chicken-and-egg evaluation.** To judge a *generated* explanation's correctness you must already know Thai. Ground truth must come from outside the LLM (dictionaries), never from it — otherwise the tool validates itself.
- **Not every word decomposes cleanly.** Loanwords, silent consonants (การันต์), leading consonants (ห/อ นำ), clusters, and irregular tones break naive rules. The system must *detect and flag* "this is an exception," not force a wrong path.
- **Coverage of the semantic layer is sparse at small scale.** Deterministic edges are dense; semantic edges (synonym, classifier) only become useful with scale or thematic seeding.

### Relationship to what already exists

- Extends the foundational data already in the repo (`mockConsonants` carries `class`; `foundational_words` table exists) rather than starting fresh.
- Aligns with the decided `th::form::type` identity scheme (see `product-documentation/research/20260514T140000Z-gap-wordid-homograph-scheme.md`) — decomposition attaches to a word identity that already handles homographs.
- Complements, does **not** replace, `@gll/srs-engine` — SRS decides *when* to review; a decomposer explains *what a word is made of*.

### Status

Exploration. The pedagogical thesis is judged sound; the deterministic-core-vs-generative-periphery split is the load-bearing decision. Next gate is the companion RFC (feasibility, stack, package shape, storage). Not scheduled.

### Related

- RFC: `product-documentation/rfcs/20260726T061655Z-decomposer-engine.md` (the how — needs discussion before commitment)
- Research: `product-documentation/research/20260514T140000Z-gap-wordid-homograph-scheme.md` (word identity)
- Package: `packages/srs-engine` (the engine archetype and existing foundational data)
- Note: the existing `packages/graph-rag` is the *codebase-knowledge* graph, unrelated to this language graph — see RFC naming discussion.
