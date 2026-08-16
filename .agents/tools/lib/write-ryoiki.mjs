// .agents/tools/lib/write-ryoiki.mjs
// Standalone id -> ryoiki writer for index.json. NOT an archive step — no
// commit-range resolution, no draft/confirm lifecycle. Reuses the shared
// rename core from archive-epic.mjs (AGN08-ST01/ST02) for ids that already
// exist; creates a new entry outright for ids that don't, built only from
// the fields the caller supplies (an epic-summary report's own columns) —
// no dependency on a prior draft ever having been written.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { applyRyoikiWrites } from './archive-epic.mjs'
import { green, red } from './style.mjs'

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function gitToplevel(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n')
}

function newStory(e) {
  const epic = (e.id.match(/^(EP[0-9]+|AGN[0-9]+)/) ?? [])[0] ?? null
  return {
    id: e.id,
    epic,
    track: 'project',
    title: e.title ?? e.id,
    domain: e.domain ?? '<non-workspace>',
    ryoiki: e.ryoiki,
    completed: e.completed ?? 'undetermined',
    duration: e.duration ?? 'undetermined',
    summary: e.summary ?? '',
    supersedes: [],
    fixes: [],
    pr: e.pr ?? null,
    compact_pr: e.compact_pr ?? null,
  }
}

export function cmdWrite(indexPath, entries) {
  if (!existsSync(indexPath)) die(`no archive index at ${indexPath}`)
  if (!Array.isArray(entries) || !entries.every((e) => e && typeof e.id === 'string' && typeof e.ryoiki === 'string')) {
    die('write-ryoiki: --data must be a JSON array of {id, ryoiki, ...} objects')
  }

  const rawIndex = readJson(indexPath)
  const existingIds = new Set((rawIndex.stories ?? []).map((s) => s.id))

  const toPatch = entries.filter((e) => existingIds.has(e.id))
  const toCreate = entries.filter((e) => !existingIds.has(e.id))

  const renames = new Map(toPatch.map((e) => [e.id, e.ryoiki]))
  const { index: patched, matchedIds } = applyRyoikiWrites(rawIndex, renames)

  const created = toCreate.map((e) => newStory(e))
  const written = { ...patched, stories: [...patched.stories, ...created] }
  writeJson(indexPath, written)

  const out = []
  out.push(green(`✓ patched ryoiki for ${matchedIds.size} existing id(s)`))
  if (created.length) out.push(green(`✓ created ${created.length} new entr${created.length === 1 ? 'y' : 'ies'}: ${created.map((c) => c.id).join(', ')}`))
  return out.join('\n') + '\n'
}

export function main(argv, execRoot) {
  const root = gitToplevel(execRoot ?? process.cwd())
  const indexPath = join(root, '.agents/changelogs/archive/index.json')

  const dataIdx = argv.indexOf('--data')
  if (dataIdx === -1) die('usage: write-ryoiki.sh --data <path|->')
  const dataArg = argv[dataIdx + 1]
  if (!dataArg) die('--data requires a path or -')
  const raw = dataArg === '-' ? readFileSync(0, 'utf8') : readFileSync(dataArg, 'utf8')

  let entries
  try {
    entries = JSON.parse(raw)
  } catch {
    die('write-ryoiki: --data must be valid JSON')
  }

  return cmdWrite(indexPath, entries)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(main(process.argv.slice(2)))
  } catch (err) {
    console.error(red(String(err?.message ?? err)))
    process.exit(1)
  }
}
