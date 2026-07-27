# Spike — Computed Romanization (Layer 1, no dictionary/LLM)

**Created**: 2026-07-27
**Status**: Complete — 57/65 (87.7%) match vs. the authored corpus
**Author**: JC Lee / PO
**Relates to**: Spike `20260726T134010Z-grapheme-decomposer-and-live-input-spike.md` (this is its
**Slice 7**), RFC `20260726T061655Z-decomposer-engine.md`, Findings
`20260726T061655Z-pythainlp-syllable-findings.md`

---

## Why this is its own document

The grapheme-decomposer spike wired the computed parser into `decompose()`/`buildGraph()` and added
the live-input UI (Slices 4–6). Romanization was the one field still falling back to echoing the
Thai text. It turned out to be a self-contained piece of work — a missing data-representation layer
plus one pure function — with its own root cause, plan, and validation harness, so it lives here
rather than bloating the parent spike. The parent keeps it as a one-line Slice 7 pointer.

## Root cause (why romanization couldn't be computed)

Romanization is a **pure Layer-1 derivation** — the findings doc already established this: consonant
→ romanized letter, vowel pattern + length → romanized vowel, tone (from `computeTone()`) →
diacritic. Nothing external needed.

The blocker was **not** logic — it was that the spike's own foundation data
(`data/foundation.json`) carried **no romanization representation for any grapheme.** As it stood:

- **Consonants** existed only as class-membership strings (`"mid": "กจฎฏดตบปอ"`). Nothing recorded
  that ก sounds like `k`, ธ like `th`, ง like `ng` in the onset.
- **Vowel patterns** had `canonical` (◌า) + `long`, but no romanized form (`aa`).
- **Tones** had a glyph (◌่) and a name (`mai ek`), but no romanization diacritic (◌̀).

So `computeTone()` knew the tone and `decomposeGraphemes()` knew which grapheme, but no data layer
said how any of it is spelled in Latin letters. That missing representation layer was the whole
reason romanization fell back to echoing the Thai text.
(`packages/srs-engine/data/seed-data/thai-full-foundations.ts` is proof the project keeps this kind
of letter-representation data elsewhere — via its `english` field per consonant/vowel — but it is
**not** imported here; the spike stays isolated per its own non-goals. It only confirmed the _shape_
of representation data to add.)

## Plan

1. **Enrich `data/foundation.json`** with the missing romanization representation:
   - each consonant → its **onset** romanization (ก→`k`, ธ→`th`, จ→`j`, ผ→`ph`, ง→`ng`…). Finals are
     already covered by the existing `sonorantFinals` / `stopFinals` maps.
   - each vowel pattern → its romanized vowel (◌า→`aa`, เ◌อ→`əə`, ◌ือ→`ʉʉ`, แ◌→`ɛɛ`…).
   - each tone → its diacritic (mid→none, low→◌̀, falling→◌̂, high→◌́, rising→◌̌).
2. **Add `computeRomanization(syllable)`** — pure, sits next to `computeTone()` in the core. Assembles
   onset + vowel (with the tone diacritic placed on it) + coda; joins multi-syllable words with `-`.
3. **Wire into `decompose()`** so every syllable carries a computed romanization; drop the manual
   romanization text field from the live-input form.
4. **Validate** against the 65 hand-authored romanizations. Expectation is **~90%+**, _not_ 100% like
   the grapheme parser — the hand-authored data has genuine internal inconsistencies (e.g.
   `คว้า→kwáa` vs `ความ→khwaam`; `ช้ำ→chám` vs `น้ำ→náam`). The mismatches the harness surfaces are a
   useful **audit of the authored data**, not parser failures.

## Scheme

Target the **phonetic + tone-diacritic** style the existing hand-authored `romanization` fields
already use (`thəə`, `kɛ̂ɛw`, `phʉ̂ng`) — IPA-ish vowels (ə ʉ ɛ ɔ), length by doubling, tone shown as
a combining diacritic. This is what the corpus established and what the findings doc's "tone →
diacritic" describes. (A plain teaching style — `thoe`, no IPA, no tone — is the alternative if ever
wanted, but is not the target.)

## Result (Session 2026-07-27)

**Built as planned.** `data/foundation.json` gained three representation layers: `onsets` (44
consonants → onset romanization, distinct from the final maps — e.g. ด is onset `d` but final `t`;
อ is a zero onset `''`), `rom` on every `vowelPattern` (◌า→`aa`, เ◌อ→`əə`, ◌ือ→`ʉʉ`…), and
`toneDiacritic` (mid→none, low→◌̀, falling→◌̂, high→◌́, rising→◌̌). `computeRomanization(raw, tone)`
in `decomposer.ts` assembles onset(s) + vowel (with the tone diacritic on its first letter) + coda;
it takes the already-computed tone so romanization and `computeTone()` never diverge. The silent
ห/อ leader and การันต์ final are correctly not voiced. `decompose()` now emits a computed
`romanization` per syllable and joins them with `-` at the word level; the manual romanization
field is gone from the live-input form.

**Validation: 57/65 = 87.7%** against the authored corpus
(`scripts/validate-romanization.ts`, mirrored offline against the committed `foundation.json`).
Exactly as the plan predicted, the 8 mismatches are an **audit of the authored data**, not parser
bugs — the computed value follows the consistent Layer-1 rule and matches the *majority* reading in
every inconsistent case:

| authored | computed | why it differs |
| --- | --- | --- |
| น้ำ `náam` | `nám` | ◌ำ authored `aam` here but `am` in น้ำตา→`nám-taa` (inconsistent) |
| หนึ่ง `nùng` | `nʉ̀ng` | ◌ึ authored `u` here but `ʉ` in ผึ้ง/จึง (inconsistent) |
| ปล่อย `plòi` | `plɔ̀ɔy` | ◌อ+ย diphthong; พลอย→`phlɔɔy` uses `ɔɔ` (inconsistent) |
| ร้อง `ráwng` | `rɔ́ɔng` | ◌อ authored `aw` here, `o`/`ɔɔ` elsewhere (inconsistent) |
| ผ่อง `phòng` | `phɔ̀ɔng` | ◌อ authored `o` (inconsistent) |
| คว้า `kwáa` | `khwáa` | ค authored `kw` here but `khw` in ความ→`khwaam` (inconsistent) |
| เศร้า `sâo` | `srâo` | false cluster ศร — the ร is silent (known Layer-1 limitation) |
| อาลัย `aa-lai` | `aa-lay` | ◌ั+ย glide → diphthong `ai` (known Layer-1 limitation) |

Six are genuine authored inconsistencies; two (`sâo`, `aa-lai`) are real phonetic subtleties
(silent ร in ศร/สร, and vowel+glide-final diphthongs) that the deliberately-simple letter-by-letter
rule doesn't model — left uncomputed and surfaced rather than special-cased, in keeping with the
spike's "compute what's cleanly computable, flag the rest" philosophy.

## Deliverable

- `data/foundation.json` — `onsets`, per-pattern `rom`, `toneDiacritic`.
- `src/core/decomposer.ts` — `computeRomanization()`, wired into `decompose()`.
- `src/core/foundation.ts` / `types.ts` — typed `ONSET` / `TONE_DIACRITIC` exports; `rom` on
  `VowelPattern`; `romanization` on `DecomposedSyllable`; authored `RawWord.romanization` now optional.
- `src/ui/LiveInput.tsx` — manual romanization field removed.
- `scripts/validate-romanization.ts` — the audit harness.
- `src/core/decomposer.test.ts` — `computeRomanization` unit + word-level tests.
