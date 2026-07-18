// .agents/tools/lib/archive-append.mjs
// Implementation behind archive-append.sh. Appends one story (and/or upserts one
// epic rollup) to the archive index, schema-validated, never leaving partial or
// invalid JSON on disk. See archive-append.sh for the CLI contract.
//
// Zero npm deps — reuses the local jsonschema.mjs validator.

import { readFileSync, writeFileSync } from 'node:fs'
import { validate } from './jsonschema.mjs'

function die(msg) {
  console.error(`✗ archive-append: ${msg}`)
  process.exit(1)
}

function readInput(pathOrDash) {
  const raw = pathOrDash === '-' ? readFileSync(0, 'utf8') : readFileSync(pathOrDash, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    die(`input is not valid JSON: ${e.message}`)
  }
}

function parseArgs(argv) {
  const opts = {
    index: '.agents/changelogs/archive/index.json',
    schema: '.agents/changelogs/archive/schema.json',
    story: null,
    epicId: null,
    epicData: null,
    replace: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--story') opts.story = argv[++i]
    else if (a === '--epic') opts.epicId = argv[++i]
    else if (a === '--data') opts.epicData = argv[++i]
    else if (a === '--index') opts.index = argv[++i]
    else if (a === '--schema') opts.schema = argv[++i]
    else if (a === '--replace') opts.replace = true
    else die(`unknown argument: ${a}`)
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.story && !opts.epicId) {
  die('nothing to do — pass --story <file|-> and/or --epic <id> --data <file|->')
}
if (opts.epicId && !opts.epicData) die('--epic <id> requires --data <file|->')

const schema = JSON.parse(readFileSync(opts.schema, 'utf8'))
let index
try {
  index = JSON.parse(readFileSync(opts.index, 'utf8'))
} catch (e) {
  die(`cannot read/parse index ${opts.index}: ${e.message}`)
}
index.stories ??= []
index.epics ??= {}

// ── Append / replace the story ───────────────────────────────────────────────
if (opts.story) {
  const story = readInput(opts.story)
  // Validate the story alone against the schema's story shape before touching the index.
  const errs = validate(story, { $ref: '#/$defs/story' }, schema)
  if (errs.length) {
    console.error('✗ archive-append: story rejected — does not match schema:')
    for (const e of errs) console.error(`  - ${e}`)
    process.exit(1)
  }
  const existingIdx = index.stories.findIndex((s) => s.id === story.id)
  if (existingIdx !== -1) {
    if (!opts.replace) {
      die(`story id "${story.id}" already exists; pass --replace to overwrite. Index unchanged.`)
    }
    index.stories[existingIdx] = story
  } else {
    index.stories.push(story)
  }
}

// ── Upsert the epic rollup ───────────────────────────────────────────────────
if (opts.epicId) {
  const epic = readInput(opts.epicData)
  const errs = validate(epic, { $ref: '#/$defs/epic' }, schema)
  if (errs.length) {
    console.error(`✗ archive-append: epic "${opts.epicId}" rejected — does not match schema:`)
    for (const e of errs) console.error(`  - ${e}`)
    process.exit(1)
  }
  index.epics[opts.epicId] = epic
}

// ── Keep stories ordered by `completed` — the organising key (D9) ────────────
index.stories.sort((a, b) => (a.completed < b.completed ? -1 : a.completed > b.completed ? 1 : 0))

// ── Full-document validation before any write ────────────────────────────────
const finalErrs = validate(index, schema)
if (finalErrs.length) {
  console.error('✗ archive-append: resulting index would be INVALID — refusing to write:')
  for (const e of finalErrs) console.error(`  - ${e}`)
  process.exit(1)
}

// ── Write only after validation passes (never partial/invalid JSON) ──────────
writeFileSync(opts.index, JSON.stringify(index, null, 2) + '\n')
console.error(`✓ archive-append: index updated (${index.stories.length} stories, ${Object.keys(index.epics).length} epics)`)
