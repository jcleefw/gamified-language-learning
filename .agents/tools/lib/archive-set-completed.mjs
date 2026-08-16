// .agents/tools/lib/archive-set-completed.mjs
// Bulk completion-date fixup: overwrite `completed` for every story in an
// epic. Standalone fixup — not part of the draft/confirm/write lifecycle.
// Use when entries were written with a wrong or placeholder `completed`
// value (e.g. today's date from the write-ryoiki.mjs create fallback)
// and need correcting after the fact.

import { readFileSync, writeFileSync } from 'node:fs'
import { validate } from './jsonschema.mjs'

function die(msg) {
  console.error(`✗ archive-set-completed: ${msg}`)
  process.exit(1)
}

function parseArgs(argv) {
  const opts = {
    index: '.agents/changelogs/archive/index.json',
    schema: '.agents/changelogs/archive/schema.json',
    epic: null,
    date: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--epic') opts.epic = argv[++i]
    else if (a === '--date') opts.date = argv[++i]
    else if (a === '--index') opts.index = argv[++i]
    else if (a === '--schema') opts.schema = argv[++i]
    else die(`unknown argument: ${a}`)
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.epic || !opts.date) {
  die('usage: archive-set-completed.mjs --epic <EP##> --date <YYYY-MM-DD>')
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
  die(`--date must be YYYY-MM-DD, got "${opts.date}"`)
}

const schema = JSON.parse(readFileSync(opts.schema, 'utf8'))
let index
try {
  index = JSON.parse(readFileSync(opts.index, 'utf8'))
} catch (e) {
  die(`cannot read/parse index ${opts.index}: ${e.message}`)
}
index.stories ??= []

// ── Find and update all stories in the epic ──────────────────────────────────
const target = index.stories.filter((s) => s.epic === opts.epic)
if (target.length === 0) {
  die(`no stories found in ${opts.epic}`)
}

for (const story of target) {
  story.completed = opts.date
}

index.stories.sort((a, b) => (a.completed < b.completed ? -1 : a.completed > b.completed ? 1 : 0))

// ── Full-document validation before any write ────────────────────────────────
const finalErrs = validate(index, schema)
if (finalErrs.length) {
  console.error('✗ archive-set-completed: resulting index would be INVALID — refusing to write:')
  for (const e of finalErrs) console.error(`  - ${e}`)
  process.exit(1)
}

// ── Write only after validation passes ────────────────────────────────────────
writeFileSync(opts.index, JSON.stringify(index, null, 2) + '\n')
const count = target.length
console.error(`✓ archive-set-completed: set completed=${opts.date} for ${count} stor${count === 1 ? 'y' : 'ies'} in ${opts.epic}`)
