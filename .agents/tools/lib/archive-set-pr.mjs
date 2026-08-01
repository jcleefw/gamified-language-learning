// .agents/tools/lib/archive-set-pr.mjs
// Bulk PR backfill: find all stories in an epic with pr: null, set pr: [number].
// Schema-validated before write; never leaves partial/invalid JSON on disk.

import { readFileSync, writeFileSync } from 'node:fs'
import { validate } from './jsonschema.mjs'

function die(msg) {
  console.error(`✗ archive-set-pr: ${msg}`)
  process.exit(1)
}

function parseArgs(argv) {
  const opts = {
    index: '.agents/changelogs/archive/index.json',
    schema: '.agents/changelogs/archive/schema.json',
    epic: null,
    pr: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--epic') opts.epic = argv[++i]
    else if (a === '--pr') opts.pr = argv[++i]
    else if (a === '--index') opts.index = argv[++i]
    else if (a === '--schema') opts.schema = argv[++i]
    else die(`unknown argument: ${a}`)
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.epic || !opts.pr) {
  die('usage: archive-set-pr.mjs --epic <EP##> --pr <number[,number,...]>')
}

const prNums = opts.pr.split(',').map((s) => {
  const n = parseInt(s.trim(), 10)
  if (isNaN(n) || n < 1) {
    die(`--pr must be a positive integer, got "${s.trim()}"`)
  }
  return n
})
if (prNums.length === 0) {
  die(`--pr is empty`)
}

const schema = JSON.parse(readFileSync(opts.schema, 'utf8'))
let index
try {
  index = JSON.parse(readFileSync(opts.index, 'utf8'))
} catch (e) {
  die(`cannot read/parse index ${opts.index}: ${e.message}`)
}
index.stories ??= []

// ── Find and update all stories in the epic with pr: null ───────────────────────
const target = index.stories.filter((s) => s.epic === opts.epic && s.pr === null)
if (target.length === 0) {
  die(`no stories found in ${opts.epic} with pr: null`)
}

for (const story of target) {
  story.pr = prNums
}

// ── Full-document validation before any write ────────────────────────────────
const finalErrs = validate(index, schema)
if (finalErrs.length) {
  console.error('✗ archive-set-pr: resulting index would be INVALID — refusing to write:')
  for (const e of finalErrs) console.error(`  - ${e}`)
  process.exit(1)
}

// ── Write only after validation passes ────────────────────────────────────────
writeFileSync(opts.index, JSON.stringify(index, null, 2) + '\n')
const count = target.length
console.error(`✓ archive-set-pr: updated ${count} stor${count === 1 ? 'y' : 'ies'} in ${opts.epic} with pr: [${prNums.join(', ')}]`)
