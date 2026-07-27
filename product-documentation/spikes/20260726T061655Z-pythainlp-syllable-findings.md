# Findings — PyThaiNLP as offline syllable/word dictionary source

**Created**: 2026-07-26
**Status**: Exploratory (offline tool run, no repo dependency added)
**Author**: JC Lee / PO (assisted)
**Relates to**: RFC `20260726T061655Z-decomposer-engine.md` (OQ-B, OQ-I, OQ-J, OQ-M), Spike plan `20260726T061655Z-decomposer-graph-spike.md`

---

## Why this was run

OQ-B already resolved that PyThaiNLP stays out of the repo runtime, usable only as a personal
offline tool whose output enters the repo as static JSON. Separately, while discussing OQ-I
(syllabification), we hit a concrete question: for multi-syllable words with no written vowel
sign on the first syllable (e.g. ขนม /khà-nǒm/), boundary-finding needs a **real dictionary**,
not an LLM guess wearing a dictionary's name tag. This session installs PyThaiNLP in a disposable
venv (not part of the repo) and inspects its actual output against our hand-authored
`spikes/decomposer-graph/data/words.json` corpus, to ground the discussion in fact instead of
recall.

## Setup

- `python3 -m venv` scratch venv (outside the repo), `pip install pythainlp` → **v5.3.4**
- `syllable_tokenize(..., engine="han_solo")` — default engine, CRF-based (`python-crfsuite`)
- `syllable_tokenize(..., engine="dict")` — dictionary longest-match, no ML
- `syllable_tokenize(..., engine="ssg")` — **unavailable**, requires a separate `ssg` package not
  installed (not pursued further; `dict`/`han_solo` already agreed on every test case)
- `pythainlp.corpus.thai_words()` — the underlying static wordlist (**62,101 entries**)

## Raw output

```
=== syllable_tokenize engine=han_solo (CRF) ===        === syllable_tokenize engine=dict (lookup only) ===
'เปรียบ' -> ['เปรียบ']                                  identical to han_solo for every word below
'ขนม'    -> ['ขนม']
'ละออง'  -> ['ละ', 'ออง']
'ผูกพัน' -> ['ผูก', 'พัน']
'น้ำตา'  -> ['น้ำ', 'ตา']
'ดวงดาว' -> ['ดวง', 'ดาว']
'อาลัย'  -> ['อา', 'ลัย']
'หนึ่ง'  -> ['หนึ่ง']
'หวาน'   -> ['หวาน']
'ศัลย์'  -> ['ศัลย์']
```

Dictionary membership check:

```
thai_words() size: 62101
'ขนม' in dict:    True
'เปรียบ' in dict: True
'ฟ้าร้อง' in dict: True
```

Sentence-level `word_tokenize` (word boundaries, coarser than syllables):

```
'น้ำตาไหลลงมาเมื่อฟ้าร้อง' -> ['น้ำตาไหล', 'ลงมา', 'เมื่อ', 'ฟ้าร้อง']
```

Garden-path case, no surrounding context:

```
'ตากลม' -> ['ตากลม']   # left unresolved as a single unknown/compound unit
```

## Translation against our schema

| Word | PyThaiNLP syllables | Matches `words.json` hand-authored split? |
|---|---|---|
| เปรียบ | `['เปรียบ']` | ✅ single syllable, `initial: ป, cluster: ร, vowel: เ◌ีย, final: บ` |
| ละออง | `['ละ', 'ออง']` | ✅ exact match, 2 syllables |
| ผูกพัน | `['ผูก', 'พัน']` | ✅ exact match |
| น้ำตา | `['น้ำ', 'ตา']` | ✅ exact match |
| ดวงดาว | `['ดวง', 'ดาว']` | ✅ exact match |
| อาลัย | `['อา', 'ลัย']` | ✅ exact match |
| หนึ่ง / หวาน / ศัลย์ | single-token | ✅ matches (ห นำ / การันต์ cases, all single-syllable) |
| ขนม | `['ขนม']` — **not split** | N/A (not in our corpus) — see finding below |

**5 for 5** on every multi-syllable word already in our hand-authored corpus. That's a real,
tool-verified signal (not my recall) that the "hybrid" lean in OQ-I is sound for the common case.

## Key findings

1. **`dict` (pure lookup, no ML) and `han_solo` (CRF) agree on every test case.** For this
   corpus, a plain static-wordlist lookup is enough — we don't need the ML engine's added
   complexity to get these right. This directly answers "what do you use to verify instead of an
   LLM": a real 62k-entry dictionary, consulted as data, matches exactly what we hand-authored.

2. **ขนม does *not* get split, and that's not a bug** — it's a single entry in the 62k dictionary.
   `syllable_tokenize` splits at *orthographically marked* syllable boundaries (each syllable has
   its own written vowel sign); where a word has an unwritten/implicit vowel and is itself a
   dictionary entry, the tool returns it whole. This confirms the residual case discussed earlier
   is real and is **not solved by simply "using the real tool"** — it needs either an
   entry-specific pronunciation dictionary (RTSD/LEXiTRON-style, with phonetic syllable breaks,
   licensing per OQ-M) or an explicit `exception`/`partial` flag per OQ-J, never a guess.

3. **Word-level (`word_tokenize`) ≠ syllable-level.** Sentence segmentation returns compounds
   (`ฟ้าร้อง` "thunder" as one word) at a coarser grain than our syllable graph wants. A full
   sentence pipeline would need `word_tokenize` → `syllable_tokenize` per resulting word → our
   `decompose()` — two cascaded segmentation steps, not one.

4. **The garden-path ambiguity is real, demonstrated, not asserted.** `ตากลม` in isolation comes
   back unresolved (`['ตากลม']`) — the tool itself has no way to pick ตา-กลม vs ตาก-ลม without
   surrounding context. This is concrete evidence for OQ-I's claim that sentence segmentation is a
   different reliability class from syllable-internal parsing.

## Implication for OQ-I / next step

- The static wordlist (`thai_words()`, 62,101 entries, bundled with PyThaiNLP) is a legitimate,
  license-worth-checking (OQ-M) source to export as **checked-in JSON** for the repo's TS engine
  to consult — this stays inside OQ-B's existing boundary (offline tool → static data, no Python
  runtime dependency).
- Recommend: export a filtered subset (or the full list) of `(word, syllables[])` pairs as data,
  use it as the dictionary-lookup fallback for words the rule tables can't fully resolve, and flag
  true out-of-vocabulary words as `exception` rather than guessing.
- Not yet decided: whether to also export phonetic-syllable-count for implicit-vowel words like
  ขนม (would need a source with pronunciation guides, e.g. RTSD/Wiktionary — separate licensing
  question, OQ-M) or to simply flag those as a smaller, known residual category.

## What PyThaiNLP does *not* solve — grapheme-role decomposition still needed

`syllable_tokenize` only returns syllable *boundaries* as plain substrings (`'ผูกพัน' ->
['ผูก', 'พัน']`). None of the `RawSyllable` fields `words.json` actually needs — `initial`,
`clusterConsonant`, `vowel` pattern, `long`, `final`, `mark`, `leadingSilent`, `silentFinal` — come
out of it. Pulling those out of a syllable string is a separate rule-based parser: closed tables
for leading vowels (เ แ โ ใ ไ), true clusters (ก/ข/ค/ต/ป/พ/ผ + ร/ล/ว), the ~30 vowel patterns, the 4
tone-mark diacritics, and การันต์'s own diacritic (์). Walked through by hand on เปรียบ (single
syllable, matches the corpus entry exactly) but **not yet coded or validated against the corpus**
the way `syllable_tokenize` was above. That's the next concrete build step.

So the full non-LLM pipeline is three independent stages, not one tool:

1. **Boundary-finding** (multi-syllable words) → PyThaiNLP `syllable_tokenize`, verified above
2. **Grapheme-role decomposition** (every syllable) → rule tables, designed, not yet built
3. **Gloss / romanization** → see below, not produced by either of the above

## Romanization — no dictionary or LLM needed, it's Layer 1

Unlike gloss, romanization is derivable from fields stage 2 already computes: consonant → romanized
letter, vowel pattern + length → romanized vowel, tone (from `computeTone()`) → diacritic. It
belongs next to `computeTone()` as another pure lookup table, not sourced externally at all.

## Gloss sourcing — verified candidates, not recalled

Checked directly (`curl registry.npmjs.org/<pkg>`, WebFetch) rather than asserting from memory,
since guessed package/URL names would be worse than no answer:

| Candidate | Verified | Verdict |
|---|---|---|
| npm `thai-romanization`, `thai2rom`, `thai-dictionary`, `wiktionary-api`, `wikt2json` | registry HTTP 404 | Don't exist — don't use these names |
| npm `wiktionary`, `node-wiktionary` | registry HTTP 200 | Real, but thin API-client wrappers, not bundled data |
| `en.wiktionary.org/w/api.php` (live MediaWiki API) | WebFetch | Real and live, but returns raw wikitext per page; a naive `section=0` query hit only the top disambiguation hatnote for น้ำ, not its Thai-language definition — needs correct per-language-section parsing |
| **`kaikki.org/dictionary/Thai/`** | WebFetch | Real, live: **17,437-word JSONL dump**, extracted 2026-07-25 from the enwiktionary dump. Practical candidate — same "offline extraction → static checked-in JSON" pattern as PyThaiNLP. License: Wiktionary content is CC BY-SA/GFDL — attribution/share-alike check needed before bulk import (OQ-M) |
| PyThaiNLP's WordNet integration (`pythainlp.corpus.wordnet`, via `nltk` + `omw-1.4`, already installed) | Ran it directly | Works, no network needed at runtime, but **noisy**: `รัก` gave sensible glosses ("be enamored," "get pleasure from"); `น้ำ` (water) surfaced `semen.n.01` as a top sense alongside `water.n.01`. English-only. Not safe to use unfiltered for a beginner-facing gloss |

**Takeaway:** a real, non-generative dictionary source doesn't automatically mean a trustworthy
gloss — PyThaiNLP's WordNet result shows the risk just moves from *hallucination* to *source
curation quality*. Recommendation: kaikki.org's Thai JSONL, filtered to corpus words and
license-checked, as the primary gloss source; LLM reserved only as an explicitly-labeled fallback
for words missing from it, never blended in silently as if looked up.

No `node`/`npm`/`pnpm` binary was available in this sandbox to run real package installs — the npm
findings above come from hitting the registry API directly (`registry.npmjs.org`), not from running
`npm install` and testing behavior. Worth a real install-and-test pass before depending on either
`wiktionary` npm package.

## Sentence-level segmentation: LLM + dictionary cross-check (5 test sentences)

Separate from syllable-internal decomposition above, this tests OQ-N's harder deferred case — live,
arbitrary **sentence** input, where word boundaries aren't given. Hypothesis under test: have an
LLM propose a word-boundary segmentation, cross-check it against PyThaiNLP's dictionary-based
`word_tokenize`, and see whether that combination is trustworthy without ever letting an LLM near
the tone computation itself.

Methodology: the LLM (this session) proposed a segmentation with self-flagged uncertainty *before*
seeing the tool's output; `word_tokenize` (`default` and `longest` engines) then ran independently;
results were diffed and disagreements checked against `thai_words()` dictionary membership.

### Test summary

| # | Sentence (excerpt) | Source | Result |
|---|---|---|---|
| A | น้ำตาไหลลงมาเมื่อฟ้าร้อง | improvised | LLM *under-fused* two real compounds (`น้ำตาไหล`, `ฟ้าร้อง`) that PyThaiNLP correctly recognized as single dictionary entries |
| B | อาจไม่มีใครรู้...มอบใจให้เธอ | song lyric | Exact match, 20/20 tokens (both engines agreed with each other and with the LLM). LLM's self-reported "medium confidence" flags on 3 boundaries didn't correlate with actual risk — a binary dictionary-membership check (`ไม่มี`/`มีกัน`/`มอบใจ` all **False**) is what actually resolved them |
| C | แม้ยามเพชรหยาดจาก...มิอาจกลั้นน้ำตาอาลัย | poem line (หยาดเพชร — the corpus `words.json` itself is authored from) | Only disagreement: `เศร้า`/`โศก`/`ศัลย์`. Both `เศร้าโศก` and `โศกศัลย์` are real dictionary entries (overlapping compounds sharing the middle syllable) — the two PyThaiNLP engines each grabbed a *different* one, disagreeing with each other, and both diverged from the correct 3-way split that matches `words.json`'s own individually-glossed entries. Only the LLM (see caveat below) landed on the right answer |
| D | หรือนี่คือความรัก...ชะโลมหัวใจในทุกตอน | different song lyric, no corpus overlap | Near-exact match, 19/20. One real miss: `ชะโลม` ("to soothe/moisten") is **absent** from the 62,101-word dictionary, so both engines fragmented it into `ชะ` + `โลม` — two *individually real* words (`ชะ`: True, `โลม`: True) that lose the intended meaning. LLM correctly kept it whole — genuinely blind this time, no corpus leakage |
| E | แฟนคลับชาวไทยกว่าคน...ฟังเพลง | loanword test | Exact match except one benign granularity difference (`ฟังเพลง` fused by the tool vs `ฟัง`+`เพลง` by the LLM — same meaning either way). Both loanwords (`แฟนคลับ`, `คอนเสิร์ต`) handled correctly by both sides — the fragmentation risk from test D doesn't generalize to *common* loanwords, only to less-common compounds actually missing from the dictionary |

### What this establishes about the proposed architecture

Proposed shape: **LLM proposes segmentation → check against dictionary → LLM cross-checks the
dictionary's result.** The five tests support this shape overall, with two refinements the evidence
forced:

1. **"Check against dictionary" must diff the LLM's full proposed segmentation against the tool's
   own independent full segmentation — not validate the LLM's tokens one at a time.** Test D is why:
   `ชะ` and `โลม` each individually pass a membership check, so a one-directional "is each LLM token
   a real word?" gate would approve the *tool's* wrong fragmentation exactly as readily as the LLM's
   correct answer — it gives no signal either way. Only diffing the two full segmentations surfaces
   the disagreement at all.

2. **The final LLM cross-check must be allowed to override the dictionary tool, not just defer to
   it.** Test C is why: both dictionary engines were wrong (or differently wrong) on
   `เศร้าโศกศัลย์`, and only contextual/poetic judgment landed on the correct 3-way split. Treating
   "dictionary says X" as ground truth would lock in an incorrect answer here.

Two more things worth carrying into any real implementation:

- **Distinguish meaning-changing disagreements from benign ones.** Test E's `ฟังเพลง` vs
  `ฟัง`+`เพลง` is a real diff but not an error — flagging every granularity difference for review
  would swamp a reviewer with noise. `ชะโลม` and `เศร้าโศกศัลย์` are the cases that actually matter
  (a fragment changes or loses meaning); a cosmetic collocation split doesn't.
- **Architectural placement stays as OQ-A/OQ-H/OQ-L already frame it.** This whole exercise is
  Layer 2 / generative periphery, relevant only to OQ-N's "live arbitrary sentence input" case — it
  must be labeled non-deterministic and reviewable, never silently trusted. Whatever segmentation the
  cross-check settles on, the downstream grapheme-role decomposition and tone computation (Layer 1)
  stay 100% deterministic, unaffected by how the boundary was chosen.

### Caveat on test methodology

Test C's success is partly confounded: the LLM had `words.json`'s hand-authored glosses in context
from earlier in this conversation, so it wasn't a fully blind segmentation call — closer to recall
than fresh judgment. Tests A, B, D, and E were genuinely blind (no corpus overlap). A rigorous
validation of "does LLM judgment generalize" would need a larger, model-unseen Thai corpus to remove
this confound entirely.

## Environment note

Installed in a disposable venv under the session scratchpad, **not added to the repo**. No
`requirements.txt`/`pyproject.toml` was created; this was purely an offline inspection run per the
existing OQ-B boundary.
