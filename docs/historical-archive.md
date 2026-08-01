# History Archival

## What is this?

A finished piece of work in this project — a feature epic (`EP##`) or an
agentic/governance change (`AGN##`) — leaves behind a folder of planning and
progress notes. Archival is the process of cleaning that up: pulling out
anything still worth remembering, and deleting the rest.

## Why does this exist?

Every finished epic or AGN leaves a folder full of planning documents, specs,
and notes. Left alone forever, the number of these folders keeps growing and
most of what's in them stops being useful — nobody needs the day-to-day
planning notes for something finished months ago. But a few facts from that
folder *are* worth keeping long-term: what was built, and what's true about
the codebase as a result. Archival is how those two get separated — the
lasting facts get saved in a permanent place, and the rest gets deleted.

## Who does this?

The user (solo developer / product owner), by hand, with an AI assistant
carrying out the steps. This is not something the AI does on its own — every
step that isn't pure bookkeeping stops and waits for a person to look at it
and say yes.

## When does this happen?

Whenever the user decides to — there's no deadline and no requirement. An
epic or AGN can be finished and just sit there, folder intact, forever.
Archiving it is a separate, later choice, not something that has to happen
for the work to count as done.

## Where does everything end up?

- **The lasting facts** move into two places:
  - `KNOWLEDGE.md` — one per project folder, plain-English notes on what's
    true about that part of the codebase now
  - `.agents/changelogs/archive/index.json` — one line per finished piece of
    work, recording what it was, when it happened, and which pull request did it
- **The epic or AGN's original folder gets deleted.** From then on, the two
  places above are the only record it ever existed in the working tree.
- **Nothing is truly lost.** The deleted folder still exists in git history —
  every commit that ever touched it is still there. If more detail than
  `KNOWLEDGE.md` and the archive entry is ever needed, it can be found by
  checking out the epic's commit range or the deletion commit's parent.

## How does it work?

The user works through a checklist
([`.agents/skills/historical/compact-epic/SKILL.md`](../.agents/skills/historical/compact-epic/SKILL.md)),
which runs a script
([`.agents/tools/archive-epic.sh`](../.agents/tools/archive-epic.sh)) one step
at a time. In order:

1. **Look up the facts** — which commits and pull request this piece of work
   came from. Written down as plain facts, no writing involved.
2. **Give each piece of work a topic label** — a short name (like
   "audio-timing" or "scheduling") saying which part of the codebase it's
   about. In the code and file names this label is called a **ryoiki** — a
   Japanese word roughly meaning "territory" or "domain," used here just as
   the term for "which topic this belongs to." The label is what becomes the
   `KNOWLEDGE.md` section it's filed under. The script checks a list of
   already-agreed labels first (`.agents/reference/ryoiki-aliases.json`) so
   the same topic doesn't end up spelled two different ways in different
   places — see [`.agents/reference/README.md`](../.agents/reference/README.md)
   for how that list is kept up to date.
3. **Skip labels that aren't worth a section** — some topics are too minor or
   too noisy to deserve their own `KNOWLEDGE.md` section; those are listed per
   project folder in `.agents/reference/ryoiki-blacklist.json` and left out.
4. **Write the lasting facts into `KNOWLEDGE.md`, then delete the folder** —
   the last step. After this, the original folder is gone and the only record
   left is the `KNOWLEDGE.md` notes plus the one-line entry in
   `.agents/changelogs/archive/index.json`.

At every step above except step 1, the script stops and waits — it never
picks a label, never decides what to skip, and never writes `KNOWLEDGE.md`
text by itself.

## Future scope

`index.json`, `KNOWLEDGE.md`, and the ryoiki labels are being kept in a
structured, consistent shape on purpose: there's a future Graph RAG layer
planned that would read these records directly. Archival's output format is
one of the things that layer would depend on.
