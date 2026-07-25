// .agents/tools/lib/archive-epic.mjs
// Implementation behind archive-epic.sh. Mechanical spine of the archive-epic
// skill (Package-Scoped Knowledge Filtering ADR; plan
// .agents/changelogs/agentic/plan/…AGN06…, §4, ST04; ported to .mjs AGN07-ST03).
//
// It sequences epic-commit-range, domains-from-diff, archive-append,
// archive-check (all now in-process imports, not re-execs) against
// index.json and the central reference files. It NEVER commits, NEVER
// writes KNOWLEDGE.md prose, and NEVER invents a ryoiki or a blacklist entry
// on its own (Golden Rule 3) — confirm/blacklist only ever apply what a
// human has already approved.
//
// Draft entries are written directly to index.json (not through the strict
// archive-append path, which stays for confirmed entries) so they can carry
// an unconfirmed `state` field. The git diff of index.json IS the review
// surface. `verify` refuses to run archive-check while any draft entries
// remain lying around.
//
// Zero npm deps beyond node built-ins + the sibling .mjs modules.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import { epicCommitRange, formatResult as formatRangeResult } from './epic-commit-range.mjs'
import { workspacePrefixes, routeDomains } from './domains-from-diff.mjs'
import { bold, dim, green, yellow, red } from './style.mjs'

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
}

function gitOrEmpty(root, args) {
  try {
    return git(root, args)
  } catch {
    return ''
  }
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

// ── blacklist ─────────────────────────────────────────────────────────────
// blacklist entries for a unit: the reserved "*" global entry plus the
// unit's own entry, deduped ([] if the file is absent or both keys absent, D5).
export function blacklistFor(blacklistPath, unit) {
  if (!existsSync(blacklistPath)) return []
  const data = readJson(blacklistPath)
  const merged = new Set([...(data['*'] ?? []), ...(data[unit] ?? [])])
  return [...merged].sort()
}

// is ryoiki `a` excluded by blacklist entry `b` (exact or path-prefix, D6)?
export function excludedBy(a, b) {
  return a === b || a.startsWith(`${b}/`)
}

function isExcluded(ryoiki, blacklist) {
  return blacklist.some((bl) => excludedBy(ryoiki, bl))
}

// ── KNOWLEDGE.md headings ────────────────────────────────────────────────
function knowledgeHeadings(file) {
  if (!existsSync(file)) return []
  const text = readFileSync(file, 'utf8')
  const headings = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^## (.*)$/)
    if (m) headings.push(m[1])
  }
  return headings
}

// ── resolve a commit range for an epic ──────────────────────────────────────
function resolveRange(root, ep, override) {
  if (override) return { status: 'firm', range: override }
  const result = epicCommitRange(root, ep)
  if (result.status === 'firm') {
    return { status: 'firm', range: `${result.suggestedFirstCommit}^ ${result.suggestedLastCommit}` }
  }
  if (result.status === 'indeterminate') {
    process.stderr.write(formatRangeResult(result))
    die(`range is indeterminate for ${ep} — investigate the flags/candidates above, then re-run with --range "<sha>^ <sha>"`)
  }
  if (result.status === 'not_found') {
    die(`no commits reference ${ep}'s changelog folder — confirm the epic id`)
  }
  die(`epic-commit-range returned unrecognised status: ${result.status}`)
}

function parseRangeFlag(argv) {
  let override = ''
  let i = 0
  while (i < argv.length) {
    const a = argv[i]
    if (a === '--range') {
      if (i + 2 < argv.length && !argv[i + 2].startsWith('--')) {
        override = `${argv[i + 1]} ${argv[i + 2]}`
        i += 3
      } else {
        override = argv[i + 1]
        i += 2
      }
    } else {
      die(`unknown argument: ${a}`)
    }
  }
  return override
}

// ── discover ─────────────────────────────────────────────────────────────
export function cmdDiscover(root, ep, argv) {
  const override = parseRangeFlag(argv)
  const { range } = resolveRange(root, ep, override)
  const [first, last] = range.split(' ')
  const domains = routeDomains(
    gitOrEmpty(root, ['diff', '--name-only', first, last])
      .split(/\r?\n/)
      .filter((f) => f !== ''),
    workspacePrefixes(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')),
  )
  const out = []
  out.push(`${bold('epic:')} ${ep}`)
  out.push(`${bold('status:')} ${green('firm')}`)
  out.push(`${bold('range:')} ${dim(`${first} ${last}`)}`)
  out.push(bold('units:'))
  for (const d of domains) out.push(`  - ${d}`)
  return out.join('\n') + '\n'
}

// ── story JSON facts for one changelog file ─────────────────────────────────
function draftStoryJson(root, ep, file, logRangeFirst, logRangeLast) {
  const base = basename(file, '.md')

  let id = (base.match(new RegExp(`${ep}-[A-Z]+[0-9]+`)) ?? [])[0]
  if (!id) {
    const bare = (base.match(/[A-Z]+[0-9]+/g) ?? []).find((m) => /^(ST|DS)[0-9]+/.test(m))
    if (bare) id = `${ep}-${bare}`
  }
  if (!id) {
    console.error(`warn: skipping ${file} — no ${ep}-XX## or XX## id in filename`)
    return null
  }

  const text = readFileSync(file, 'utf8')
  const titleMatch = text.match(/^# (.*)$/m)
  let title = titleMatch ? titleMatch[1].replace(new RegExp(`^(${id}: )?`), '') : ''
  if (!title) title = id

  const slug = base.replace(/^[0-9TZ]+-/, '').replace(new RegExp(`^${id}-`), '')

  const domainMatches = [...text.matchAll(/`(apps|packages)\/[A-Za-z0-9_-]+/g)].map((m) => m[0].slice(1))
  let domain = '<non-workspace>'
  if (domainMatches.length) {
    const counts = new Map()
    for (const d of domainMatches) counts.set(d, (counts.get(d) ?? 0) + 1)
    domain = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  let completed =
    gitOrEmpty(root, ['log', '--format=%ad', '--date=short', '-1', `${logRangeFirst}..${logRangeLast}`, '--', file]).trim()
  if (!completed) {
    completed = gitOrEmpty(root, ['log', '--format=%ad', '--date=short', '-1', `${logRangeFirst}..${logRangeLast}`]).trim()
  }
  if (!completed) completed = new Date().toISOString().slice(0, 10)

  const lastSubject = gitOrEmpty(root, ['log', '-1', '--format=%s', logRangeLast]).trim()
  const prMatch = lastSubject.match(/#([0-9]+)/)
  const pr = prMatch ? Number(prMatch[1]) : null

  const summaryMatch = text.match(/^## (?:Summary|What changed)\s*$([\s\S]*?)(?=^## |^---)/m)
  let summary = ''
  if (summaryMatch) {
    summary = summaryMatch[1]
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  if (!summary) summary = `TODO: summarize — see ${relFromRoot(root, file)}`

  return {
    id,
    epic: ep,
    track: 'project',
    title,
    domain,
    ryoiki: slug,
    completed,
    duration: 'undetermined',
    summary,
    supersedes: [],
    fixes: [],
    pr,
    compact_pr: null,
    state: 'draft',
  }
}

// ── draft ────────────────────────────────────────────────────────────────
export function cmdDraft(root, ep, argv, paths) {
  const override = parseRangeFlag(argv)
  needIndex(paths.index)

  const { range } = resolveRange(root, ep, override)
  const [first, last] = range.split(' ')

  const changelogsEntries = readdirSync(paths.changelogsDir, { withFileTypes: true })
  const folderEntry = changelogsEntries.find((e) => e.isDirectory() && e.name.startsWith(`${ep}--`))
  if (!folderEntry) die(`no ${ep}--*/ folder under ${paths.changelogsDir}`)
  const folder = join(paths.changelogsDir, folderEntry.name)

  const files = readdirSync(folder)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => join(folder, f))

  const drafts = []
  for (const file of files) {
    const story = draftStoryJson(root, ep, file, first, last)
    if (story) drafts.push(story)
  }
  if (drafts.length === 0) die(`no drafts produced from ${folder}`)

  const index = readJson(paths.index)
  index.stories ??= []
  const ids = index.stories.map((s) => s.id)
  const skipped = []

  for (const d of drafts) {
    const i = ids.indexOf(d.id)
    if (i !== -1 && !('state' in index.stories[i])) {
      skipped.push(d.id)
    } else if (i !== -1) {
      index.stories[i] = d
    } else {
      index.stories.push(d)
      ids.push(d.id)
    }
  }

  index.stories.sort((a, b) => (a.completed < b.completed ? -1 : a.completed > b.completed ? 1 : 0))
  writeJson(paths.index, index)

  const out = []
  out.push(green(`✓ drafted ${drafts.length} stor(y/ies) from ${relFromRoot(root, folder)}`))
  if (skipped.length) {
    out.push(dim('  already confirmed, left untouched:'))
    for (const id of skipped) out.push(dim(`    - ${id}`))
  }
  out.push(yellow("Review + correct 'ryoiki' (and anything else) in the index.json diff, then delete each entry's \"state\" line to confirm."))
  return out.join('\n') + '\n'
}

function relFromRoot(root, p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p
}

// ── status ───────────────────────────────────────────────────────────────
export function cmdStatus(ep, paths) {
  needIndex(paths.index)
  const index = readJson(paths.index)
  const stories = index.stories ?? []
  const out = []
  out.push(`${bold('epic:')} ${ep}`)
  out.push(bold(green('confirmed:')))
  for (const s of stories) {
    if (s.epic === ep && !('state' in s)) out.push(`  - ${s.id}  domain=${s.domain}  ryoiki=${s.ryoiki}`)
  }
  out.push(bold(yellow('draft:')))
  for (const s of stories) {
    if (s.epic === ep && 'state' in s) out.push(`  - ${s.id}  domain=${s.domain}  ryoiki=${s.ryoiki}  ${yellow(`state=${s.state}`)}`)
  }
  return out.join('\n') + '\n'
}

// Human shorthand for `confirm --map`, e.g.:
//   "st01: coffee-shop, ~~st02~~, st03: travel"
// Bare id -> EP##-<ID> (case-insensitive). ~~id~~ marks the entry for
// deletion instead of confirmation. Only ids named here are touched;
// everything else for the epic is left as-is (still draft).
export function parseMapShorthand(ep, mapStr) {
  const renames = new Map()
  const deletes = new Set()
  const entries = mapStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const entry of entries) {
    const delMatch = entry.match(/^~~(.+?)~~$/)
    if (delMatch) {
      deletes.add(`${ep}-${delMatch[1].trim().toUpperCase()}`)
      continue
    }
    const i = entry.indexOf(':')
    if (i === -1) die(`confirm --map: expected "id: ryoiki-name" or "~~id~~", got "${entry}"`)
    const id = entry.slice(0, i).trim().toUpperCase()
    const ryoiki = entry.slice(i + 1).trim()
    if (!ryoiki) die(`confirm --map: missing ryoiki name for "${entry}"`)
    renames.set(`${ep}-${id}`, ryoiki)
  }

  return { renames, deletes }
}

// ── confirm ──────────────────────────────────────────────────────────────
export function cmdConfirm(ep, overrides, paths, mapOpts) {
  needIndex(paths.index)
  const renames = new Map()
  for (const o of overrides) {
    if (o.ryoiki != null) renames.set(o.id, o.ryoiki)
  }

  const index = readJson(paths.index)
  const deletes = mapOpts?.deletes ?? new Set()
  const onlyIds = mapOpts?.renames ? new Set(mapOpts.renames.keys()) : null
  if (mapOpts?.renames) for (const [id, ryoiki] of mapOpts.renames) renames.set(id, ryoiki)

  index.stories = (index.stories ?? [])
    .filter((s) => !(s.epic === ep && deletes.has(s.id)))
    .map((s) => {
      if (s.epic === ep && 'state' in s && (!onlyIds || onlyIds.has(s.id))) {
        const next = { ...s }
        if (renames.has(next.id)) next.ryoiki = renames.get(next.id)
        delete next.state
        return next
      }
      return s
    })
  writeJson(paths.index, index)

  const n = index.stories.filter((s) => s.epic === ep && !('state' in s)).length
  const remaining = index.stories.filter((s) => s.epic === ep && 'state' in s).length
  const delMsg = deletes.size ? `, ${deletes.size} deleted` : ''
  const draftMsg = onlyIds && remaining ? `, ${remaining} still draft` : ''
  return green(`✓ confirmed ${ep} draft entries (${n} confirmed total for this epic${delMsg}${draftMsg})`) + '\n'
}

// ── blacklist ────────────────────────────────────────────────────────────
export function cmdBlacklist(unit, additions, paths) {
  if (!additions.length) die('blacklist: --add <ryoiki1,ryoiki2,...> is required')
  const data = existsSync(paths.blacklist) ? readJson(paths.blacklist) : {}
  const merged = [...new Set([...(data[unit] ?? []), ...additions])].sort()
  data[unit] = merged
  writeJson(paths.blacklist, data)
  return green(`✓ ${unit} blacklist is now: ${JSON.stringify(merged)}`) + '\n'
}

// ── scaffold ─────────────────────────────────────────────────────────────
export function cmdScaffold(unit, paths) {
  needIndex(paths.index)
  const blacklist = blacklistFor(paths.blacklist, unit)
  const index = readJson(paths.index)
  const confirmed = [
    ...new Set(
      (index.stories ?? [])
        .filter((s) => s.domain === unit && !('state' in s))
        .map((s) => s.ryoiki),
    ),
  ].sort()

  const out = []
  out.push(dim('---'))
  out.push(`${bold('unit:')} ${unit}`)
  out.push('sources: []')
  out.push(`updated: ${new Date().toISOString().slice(0, 10)}`)
  out.push(dim('---'))
  out.push('')
  for (const ryoiki of confirmed) {
    if (!isExcluded(ryoiki, blacklist)) out.push(bold(`## ${ryoiki}`))
  }
  return out.join('\n') + '\n'
}

// ── check ────────────────────────────────────────────────────────────────
export function cmdCheck(root, paths) {
  needIndex(paths.index)
  const index = readJson(paths.index)
  const units = [
    ...new Set(
      (index.stories ?? [])
        .filter((s) => !('state' in s))
        .map((s) => s.domain)
        .filter((d) => /^(apps|packages)\//.test(d)),
    ),
  ].sort()

  const failures = []
  for (const unit of units) {
    const blacklist = blacklistFor(paths.blacklist, unit)
    const confirmed = [
      ...new Set(
        (index.stories ?? [])
          .filter((s) => s.domain === unit && !('state' in s))
          .map((s) => s.ryoiki),
      ),
    ].sort()
    const doc = join(root, unit, 'KNOWLEDGE.md')
    const headings = knowledgeHeadings(doc)

    for (const ryoiki of confirmed) {
      if (isExcluded(ryoiki, blacklist)) continue // legitimately headless (D9)
      if (!headings.includes(ryoiki)) {
        failures.push(red(`✗ ${unit}: confirmed ryoiki "${ryoiki}" has no "## ${ryoiki}" heading in ${relFromRoot(root, doc)}`))
      }
    }
  }

  if (failures.length) {
    for (const f of failures) console.error(f)
    return { ok: false, output: '' }
  }
  return { ok: true, output: green('✓ check: confirmed ryoiki ⊆ ## headings, for every unit') + '\n' }
}

// ── verify ───────────────────────────────────────────────────────────────
export function cmdVerify(root, paths, runArchiveCheck) {
  needIndex(paths.index)
  const index = readJson(paths.index)
  const drafts = (index.stories ?? []).filter((s) => 'state' in s).map((s) => s.id)
  if (drafts.length) {
    console.error(red('✗ verify: unconfirmed draft entries remain in index.json — confirm (delete "state") or discard before verifying:'))
    for (const id of drafts) console.error(`  - ${id}`)
    return { ok: false }
  }
  const archiveCheckOk = runArchiveCheck()
  const check = cmdCheck(root, paths)
  if (check.output) process.stdout.write(check.output)
  return { ok: archiveCheckOk && check.ok }
}

// ── backfill ─────────────────────────────────────────────────────────────
function backfillCompactPrInfo(root, epNumber) {
  const match = gitOrEmpty(root, ['log', '--all', `--grep=compact ${epNumber}`, '--format=%H %s%n%b'])
  if (!match.trim()) return 'undetermined'
  const m = match.match(/Merge pull request #([0-9]+)/)
  return m ? m[1] : 'undetermined'
}

export function cmdBackfill(root, paths) {
  needIndex(paths.index)
  const index = readJson(paths.index)
  const epics = [
    ...new Set((index.stories ?? []).filter((s) => s.compact_pr === null).map((s) => s.epic)),
  ].sort()
  if (epics.length === 0) return green('✓ backfill: no stories with compact_pr: null') + '\n'
  const out = []
  for (const ep of epics) {
    const pr = backfillCompactPrInfo(root, ep)
    out.push(`${ep}: compact_pr=${pr}`)
  }
  return out.join('\n') + '\n'
}

// ── compact ──────────────────────────────────────────────────────────────
export function cmdCompact(root, ep, paths) {
  needIndex(paths.index)
  const changelogsEntries = readdirSync(paths.changelogsDir, { withFileTypes: true })
  const folderEntry = changelogsEntries.find((e) => e.isDirectory() && e.name.startsWith(`${ep}--`))
  if (!folderEntry) die(`no ${ep}--*/ folder under ${paths.changelogsDir} — already compacted?`)
  const folder = folderEntry.name

  const index = readJson(paths.index)
  const domains = [
    ...new Set((index.stories ?? []).filter((s) => s.epic === ep && !('state' in s)).map((s) => s.domain)),
  ]
  let title = index.epics?.[ep]?.title ?? ''
  if (!title) {
    const epicsDir = join(root, '.agents/plans/epics')
    if (existsSync(epicsDir)) {
      const planFile = readdirSync(epicsDir).find((f) => f.startsWith(`${ep}-`))
      if (planFile) {
        const text = readFileSync(join(epicsDir, planFile), 'utf8')
        const m = text.match(/^# EP[0-9]+\s*[:—-]\s*(.*)$/m)
        if (m) title = m[1]
      }
    }
  }
  if (!title) title = 'TODO: epic title'

  const epicData = { title, domains, archived: new Date().toISOString().slice(0, 10) }
  const toolsDir = join(root, '.agents/tools')

  const out = []
  out.push('# Run these once the epic\'s PR is merged to main and all its stories are confirmed:')
  out.push('')
  out.push(`echo '${JSON.stringify(epicData, null, 2)}' | ${toolsDir}/archive-append.sh --epic ${ep} --data -`)
  out.push(`git rm -r ${relFromRoot(root, join(paths.changelogsDir, folder))}`)
  out.push(`git commit -m "docs(archive): compact ${ep}"`)
  return out.join('\n') + '\n'
}

function needIndex(indexPath) {
  if (!existsSync(indexPath)) die(`no archive index at ${indexPath}`)
}

// ── dispatch ─────────────────────────────────────────────────────────────
export function paths(root) {
  return {
    index: join(root, '.agents/changelogs/archive/index.json'),
    blacklist: join(root, '.agents/reference/ryoiki-blacklist.json'),
    changelogsDir: join(root, '.agents/changelogs'),
  }
}

export function main(argv, execRoot) {
  const root = gitToplevel(execRoot ?? process.cwd())
  const p = paths(root)
  const subcommand = argv[0]
  const rest = argv.slice(1)

  switch (subcommand) {
    case 'discover': {
      const ep = rest[0]
      if (!ep) die('usage: discover EP## [--range ...]')
      return cmdDiscover(root, ep, rest.slice(1))
    }
    case 'draft': {
      const ep = rest[0]
      if (!ep) die('usage: draft EP## [--range ...]')
      return cmdDraft(root, ep, rest.slice(1), p)
    }
    case 'status': {
      const ep = rest[0]
      if (!ep) die('usage: status EP##')
      return cmdStatus(ep, p)
    }
    case 'confirm': {
      const ep = rest[0]
      if (!ep) die('usage: confirm EP## [--data -] [--map "st01: ryoiki, ~~st02~~, ..."]')
      let overrides = []
      const dataIdx = rest.indexOf('--data')
      if (dataIdx !== -1) {
        const dataArg = rest[dataIdx + 1]
        if (!dataArg) die('--data requires a path or -')
        const raw = dataArg === '-' ? readFileSync(0, 'utf8') : readFileSync(dataArg, 'utf8')
        overrides = JSON.parse(raw)
        if (!Array.isArray(overrides) || !overrides.every((o) => 'id' in o)) {
          die('confirm: --data must be a JSON array of {id, ryoiki?} objects')
        }
      }
      let mapOpts
      const mapIdx = rest.indexOf('--map')
      if (mapIdx !== -1) {
        const mapArg = rest[mapIdx + 1]
        if (!mapArg) die('--map requires a string, e.g. "st01: ryoiki-name, ~~st02~~"')
        mapOpts = parseMapShorthand(ep, mapArg)
      }
      return cmdConfirm(ep, overrides, p, mapOpts)
    }
    case 'blacklist': {
      const unit = rest[0]
      if (!unit) die('usage: blacklist <apps/foo|packages/bar> --add r1,r2,...')
      const addIdx = rest.indexOf('--add')
      const add = addIdx !== -1 ? rest[addIdx + 1] : ''
      const additions = (add ?? '').split(',').filter((s) => s.length > 0)
      return cmdBlacklist(unit, additions, p)
    }
    case 'scaffold': {
      const unit = rest[0]
      if (!unit) die('usage: scaffold <apps/foo|packages/bar>')
      return cmdScaffold(unit, p)
    }
    case 'check': {
      const result = cmdCheck(root, p)
      if (!result.ok) process.exit(1)
      return result.output
    }
    case 'verify': {
      const runArchiveCheck = () => {
        try {
          execFileSync('node', [join(root, '.agents/tools/lib/archive-check.mjs'), '--root', root], {
            stdio: 'inherit',
          })
          return true
        } catch {
          return false
        }
      }
      const result = cmdVerify(root, p, runArchiveCheck)
      if (!result.ok) process.exit(1)
      return ''
    }
    case 'backfill':
      return cmdBackfill(root, p)
    case 'compact': {
      const ep = rest[0]
      if (!ep) die('usage: compact EP##')
      return cmdCompact(root, ep, p)
    }
    default:
      die('usage: archive-epic.sh {discover|draft|status|confirm|blacklist|scaffold|check|verify|backfill|compact} ...')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = main(process.argv.slice(2))
  if (out) process.stdout.write(out)
}
