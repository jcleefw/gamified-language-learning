# @gll/srs-review

Long-term review scheduling for graduated words, backed by FSRS (`ts-fsrs`). Pure library: no I/O, no persistence. A word leaves the Learning phase (`@gll/srs-engine-v2`) and enters Review here as a `ReviewCard`.

## Public API

```ts
import { FsrsScheduler } from '@gll/srs-review';
import type {
  ReviewScheduler, ReviewCard, ReviewRating, GraduationPerformance,
} from '@gll/srs-review';
```

- **`ReviewScheduler`** — swappable scheduling contract:
  - `seed(wordId, performance, now)` → first `ReviewCard` for a freshly graduated word
  - `schedule(card, rating, now)` → advance a card after a review
  - `isDue(card, now)` → whether the card is due
- **`FsrsScheduler`** — the FSRS implementation of `ReviewScheduler`.
- **`ReviewCard`** — `{ wordId, due, schedulerData }`. `due` is the only field callers/stores read; `schedulerData` is opaque and owned by the scheduler.
- **`ReviewRating`** — `'again' | 'hard' | 'good' | 'easy'`, inferred by the runner, never asked.
- **`GraduationPerformance`** — primitive snapshot at graduation (`correctStreak`, `lapses`, `correctRatio`). The app derives this from `WordState`; this package never imports `WordState`.

## Usage

```ts
const scheduler = new FsrsScheduler();
const card = scheduler.seed(wordId, performance, new Date());
const next = scheduler.schedule(card, 'good', new Date());
```
