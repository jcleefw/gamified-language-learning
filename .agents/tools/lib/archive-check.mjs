// .agents/tools/lib/archive-check.mjs
// Implementation behind archive-check.sh. Enforces cross-axis invariants.
// Zero npm deps.
//
// Invariants:
//   1. index.json validates against schema.json.
//   2. Every `sources` id in any KNOWLEDGE.md resolves to an archive epic/story (D5).
//   3. No archived epic still has a live changelogs/<EP##>--*/ folder (D10),
//      and no archived AGN## still has a plans/AGN##-*.md plan (D11).
//   4. No _loose/ entry lacks a `domain` + a `fixes`/`relates` reference (D9).

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { validate } from './jsonschema.mjs'

function parseArgs(argv) {
  const opts = { root: null, index: null, schema: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') opts.root = argv[++i]
    else if (a === '--index') opts.index = argv[++i]
    else if (a === '--schema') opts.schema = argv[++i]
    else {
      console.error(`archive-check: unknown argument: ${a}`)
      process.exit(2)
    }
  }
  return opts
}

// Minimal frontmatter reader for the keys we need: scalars, inline [a, b] arrays,
// and block "- item" lists. Not a general YAML parser.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const out = {}
  const lines = m[1].split(/\r?\n/)
  let currentKey = null
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, '') // strip trailing comments
    if (/^\s*#/.test(line) || line.trim() === '') continue
    const blockItem = line.match(/^\s+-\s+(.*)$/)
    if (blockItem && currentKey) {
      out[currentKey].push(unquote(blockItem[1].trim()))
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, valRaw] = kv
    const val = valRaw.trim()
    if (val === '') {
      out[key] = [] // maybe a block list follows
      currentKey = key
    } else if (val.startsWith('[')) {
      out[key] = val
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter((s) => s !== '')
      currentKey = null
    } else {
      out[key] = unquote(val)
      currentKey = null
    }
  }
  return out
}

const unquote = (s) => s.replace(/^["']|["']$/g, '')

function walk(dir, matchName, acc) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, matchName, acc)
    else if (entry.name === matchName) acc.push(full)
  }
  return acc
}

const opts = parseArgs(process.argv.slice(2))
const root = opts.root || process.cwd()
const indexPath = opts.index || join(root, '.agents/changelogs/archive/index.json')
const schemaPath = opts.schema || join(root, '.agents/changelogs/archive/schema.json')
const changelogsDir = join(root, '.agents/changelogs')
const looseDir = join(changelogsDir, '_loose')
const plansDir = join(root, '.agents/changelogs/agentic/plans')

const failures = []
const fail = (msg) => failures.push(msg)

// ── 1. index validates against schema ────────────────────────────────────────
let index = null
try {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  index = JSON.parse(readFileSync(indexPath, 'utf8'))
  const errs = validate(index, schema)
  for (const e of errs) fail(`index invalid against schema: ${e}`)
} catch (e) {
  fail(`cannot load/validate index: ${e.message}`)
}

// ── Build the set of ids the archive knows about ─────────────────────────────
const knownIds = new Set()
if (index) {
  for (const s of index.stories ?? []) {
    if (s.id) knownIds.add(s.id)
    if (s.epic) knownIds.add(s.epic)
  }
  for (const k of Object.keys(index.epics ?? {})) knownIds.add(k)
}

// ── 2. every KNOWLEDGE.md `sources` id resolves ──────────────────────────────
const knowledgeDocs = [
  ...walk(join(root, 'apps'), 'KNOWLEDGE.md', []),
  ...walk(join(root, 'packages'), 'KNOWLEDGE.md', []),
]
for (const doc of knowledgeDocs) {
  const fm = frontmatter(readFileSync(doc, 'utf8'))
  const rel = relative(root, doc)
  if (!fm) {
    fail(`${rel}: missing YAML frontmatter (needs unit/concern/sources/updated)`)
    continue
  }
  const sources = Array.isArray(fm.sources) ? fm.sources : fm.sources ? [fm.sources] : []
  for (const id of sources) {
    if (!knownIds.has(id)) {
      fail(`${rel}: sources id "${id}" does not resolve to any archive epic/story (D5)`)
    }
  }
}

// ── 3. no archived epic keeps a live changelog folder / plan ─────────────────
if (index) {
  const changelogEntries = existsSync(changelogsDir)
    ? readdirSync(changelogsDir, { withFileTypes: true })
    : []
  const planEntries = existsSync(plansDir) ? readdirSync(plansDir) : []
  for (const [epicId, epic] of Object.entries(index.epics ?? {})) {
    if (!epic.archived) continue
    if (epicId.startsWith('AGN')) {
      const strayPlan = planEntries.find((n) => n.startsWith(`${epicId}-`) || n.includes(`-${epicId}-`))
      if (strayPlan) fail(`archived agentic ${epicId} still has a live plan: plans/${strayPlan} (D11)`)
    } else {
      const strayFolder = changelogEntries.find(
        (e) => e.isDirectory() && e.name.startsWith(`${epicId}--`),
      )
      if (strayFolder) fail(`archived epic ${epicId} still has a live folder: changelogs/${strayFolder.name}/ (D10)`)
    }
  }
}

// ── 4. every _loose/ entry has a domain + fixes/relates ──────────────────────
if (existsSync(looseDir)) {
  for (const name of readdirSync(looseDir)) {
    if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue
    const fm = frontmatter(readFileSync(join(looseDir, name), 'utf8'))
    if (!fm) {
      fail(`_loose/${name}: missing frontmatter (needs domain + fixes/relates) (D9)`)
      continue
    }
    if (!fm.domain) fail(`_loose/${name}: missing \`domain\` (D9)`)
    const hasRef =
      (Array.isArray(fm.fixes) ? fm.fixes.length : fm.fixes) ||
      (Array.isArray(fm.relates) ? fm.relates.length : fm.relates)
    if (!hasRef) fail(`_loose/${name}: missing a \`fixes\`/\`relates\` reference to a sealed epic (D9)`)
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`✗ archive-check: ${failures.length} problem(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.error(
  `✓ archive-check: clean — ${knownIds.size} archive id(s), ${knowledgeDocs.length} KNOWLEDGE.md doc(s) checked`,
)
process.exit(0)
