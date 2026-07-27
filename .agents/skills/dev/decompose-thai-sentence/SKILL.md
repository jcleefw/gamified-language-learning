---
name: decompose-thai-sentence
description: 'Decomposes a live Thai sentence into words, syllables, tone, and romanization. Use when the user supplies a Thai sentence and wants its word boundaries, tones, or romanization computed rather than looked up.'
---

# Decompose Thai Sentence

Ask the user for the Thai sentence if not already given. Then follow these steps in order.

## Step 1 — Ensure the environment

Fixed external location, outside the repo: `$HOME/.local/share/gll-decomposer/` (`venv/` + `tokenize.py`).

1. Check `$HOME/.local/share/gll-decomposer/venv/bin/python -c "import pythainlp"`.
2. If it fails: `mkdir -p $HOME/.local/share/gll-decomposer && python3 -m venv $HOME/.local/share/gll-decomposer/venv && $HOME/.local/share/gll-decomposer/venv/bin/pip install pythainlp`.
3. Check `$HOME/.local/share/gll-decomposer/tokenize.py` exists. If not, write it with exactly this content:

```python
import json, sys
from pythainlp.tokenize import word_tokenize, syllable_tokenize

mode, text = sys.argv[1], sys.argv[2]
if mode == "word":
    print(json.dumps({
        "default": word_tokenize(text, engine="newmm"),
        "longest": word_tokenize(text, engine="longest"),
    }))
elif mode == "syllable":
    print(json.dumps({"syllables": syllable_tokenize(text, engine="dict")}))
```

Never write `tokenize.py` or the venv into the repo — this stays a personal, offline machine tool per RFC OQ-B.

## Step 2 — Propose segmentation blind

Before running any tool, segment the sentence into words yourself and flag any boundary you're unsure of. Do not look at the dictionary output yet.

## Step 3 — Run the dictionary tokenizer

`$HOME/.local/share/gll-decomposer/venv/bin/python $HOME/.local/share/gll-decomposer/tokenize.py word "<sentence>"`

## Step 4 — Diff and adjudicate

Compare your full proposed segmentation against `default` and `longest` as whole sequences — not token-by-token membership (a wrong split can still pass a per-token dictionary check). For every disagreement:

- Classify it as **meaning-changing** (a fragment loses or changes meaning) or **benign** (same meaning, different granularity, e.g. a collocation split).
- Settle each meaning-changing disagreement yourself. You may override the dictionary — it is not ground truth.
- Only list benign disagreements; don't ask the user to review them.

Record the final settled word list, and separately record every meaningful override with a one-line reason.

## Step 5 — Syllable-tokenize each settled word

For each word: `$HOME/.local/share/gll-decomposer/venv/bin/python $HOME/.local/share/gll-decomposer/tokenize.py syllable "<word>"`

## Step 6 — Decompose each word deterministically

For each word, pipe its syllables into the existing TS pipeline — no logic is re-implemented here:

```
echo '{"thai":"<word>","syllables":["<syl1>","<syl2>"]}' | pnpm exec tsx spikes/decomposer-graph/scripts/decompose-word.ts
```

This runs the already-validated `decompose()` (grapheme roles, tone, romanization). If a syllable can't be parsed, it comes back flagged as an exception — never guessed.

## Step 7 — Present results

Show two clearly separated sections:

1. **Word boundaries (Layer 2, judgment-based)** — the settled word list and any overrides with their reasons.
2. **Decomposition (Layer 1, deterministic)** — per word: syllables, tone, romanization, and any flagged exceptions.

Never merge the two into one table as if both were computed the same way.

## Rules

- The LLM only ever decides word boundaries. Tone, grapheme roles, and romanization are always computed by `decompose()` — never estimated or guessed by the LLM.
- Don't silently accept the dictionary tool's output, and don't silently accept your own first guess — every meaning-changing disagreement gets resolved explicitly.
- Node is required (`pnpm exec tsx`) for Step 6; Python is required only for Steps 1, 3, 5, and never touches the repo.
