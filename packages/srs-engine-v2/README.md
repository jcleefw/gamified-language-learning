# @gll/srs-engine-v2

The word lifecycle engine for a language-learning app: learning, shelving, and review. Pure TypeScript, no I/O, no side effects.

## Quick start

**How it works?** See [docs/](docs/) for humanized explanations at three levels:
- **5 min** — [Product view](docs/01-stakeholder.md): what the engine does and why
- **10 min** — [Developer view](docs/02-concepts.md): architecture and key concepts
- **15 min** — [Trace view](docs/03-walkthrough.md): step-by-step algorithm walkthrough

## Library API

```ts
import {
  composeWordBatchMulti,
  composeSentenceBatch,
  updateMasteryState,
  initAdaptiveSession,
  advanceAdaptiveSession,
} from '@gll/srs-engine-v2';
```

All functions are pure: no I/O, no persistence, same inputs → same outputs.

## Terminal demo

```bash
pnpm learnv2          # interactive mode (prompts for answers)
AUTO_MODE=true pnpm learnv2   # auto mode (auto-answers all questions)
```

Edit `demo/config.ts` to adjust settings or `demo/learning-runner.ts` to change which words are drilled.

## Tests

```bash
pnpm test                                    # all tests
pnpm test:watch                              # watch mode
pnpm --filter @gll/srs-engine-v2 test        # from repo root
```

## Architecture

See [CODEMAP.md](CODEMAP.md) for full file navigation and [docs/02-concepts.md](docs/02-concepts.md) for architecture overview.
