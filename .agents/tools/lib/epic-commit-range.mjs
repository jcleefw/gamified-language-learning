// .agents/tools/lib/epic-commit-range.mjs
// Implementation behind epic-commit-range.sh. Gathers the commit-range
// candidates for an epic and reports them for a human to confirm. See
// epic-commit-range.sh for the full CLI contract / resolution-order rationale.
//
// Zero npm deps.

import { execFileSync } from 'node:child_process'
import { bold, dim, yellow, red, statusColor } from './style.mjs'

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

function gitToplevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

function lines(text) {
  return text.split(/\r?\n/).filter((l) => l !== '')
}

function emitFlags(flags) {
  const label = bold('flags:')
  const joined = flags.join(',')
  return flags.length ? `${label} ${yellow(joined)}` : `${label} ${joined}`
}

// ── Path 2 helper: branch-divergence result, or null if not applicable ──────
function branchDivergence(root, pathspecs) {
  const branch = gitOrEmpty(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  if (branch === 'main' || !branch) return null
  try {
    git(root, ['show-ref', '--verify', '--quiet', 'refs/heads/main'])
  } catch {
    return null
  }
  const base = git(root, ['merge-base', 'main', 'HEAD']).trim()
  const tip = git(root, ['rev-parse', 'HEAD']).trim()
  if (base === tip) return null
  const touching = git(root, ['log', '--format=%H', `${base}..${tip}`, '--', ...pathspecs]).trim()
  if (!touching) return null
  return { firstCommit: base, lastCommit: tip }
}

export function epicCommitRange(root, ep) {
  // tolerate both the current `EP##--slug` convention and legacy `EP##-slug`
  // single-hyphen folders (e.g. EP22) that predate it
  const pathspecs = [`.agents/changelogs/${ep}--*`, `.agents/changelogs/${ep}-*`]
  const shas = lines(git(root, ['log', 'main', '--reverse', '--format=%H', '--', ...pathspecs]))

  if (shas.length === 0) {
    const div = branchDivergence(root, pathspecs)
    if (div) {
      return {
        epic: ep,
        status: 'firm',
        source: 'branch-divergence',
        suggestedFirstCommit: div.firstCommit,
        suggestedLastCommit: div.lastCommit,
        flags: [],
        candidates: [],
      }
    }
    return { epic: ep, status: 'not_found' }
  }

  const cleanShas = []
  let flagEntangled = false
  let flagRevert = false
  let flagNoMergeMarker = true
  const candidates = []

  for (const sha of shas) {
    const date = git(root, ['log', '-1', '--format=%ad', '--date=short', sha]).trim()
    const subject = git(root, ['log', '-1', '--format=%s', sha]).trim()

    const addedFiles = git(root, ['show', '--diff-filter=A', '--name-only', '--format=', sha, '--', ...pathspecs]).trim()
    const isAdd = addedFiles !== ''

    const isRevert = /^Revert/.test(subject)

    const touchedFiles = lines(git(root, ['show', '--name-only', '--format=', sha]))
    const alsoTouches = [
      ...new Set(
        touchedFiles
          .map((f) => f.match(/^\.agents\/changelogs\/(EP[0-9]+)/))
          .filter(Boolean)
          .map((m) => m[1])
          .filter((id) => id !== ep),
      ),
    ].sort()

    if (alsoTouches.length) flagEntangled = true
    if (isRevert) flagRevert = true
    if (/Merge pull request #[0-9]+|\(#[0-9]+\)$/.test(subject)) flagNoMergeMarker = false
    if (!isRevert) cleanShas.push(sha)

    candidates.push({ sha, date, isAdd, isRevert, alsoTouches, subject })
  }

  const suggestedFirst = cleanShas.length ? cleanShas[0] : ''
  const suggestedLast = cleanShas.length ? cleanShas[cleanShas.length - 1] : ''

  // ── Prior archive check ────────────────────────────────────────────────────
  const mainLog = git(root, ['log', 'main', '--format=%H %s'])
  const archiveHit = lines(mainLog).find((l) => /^\S+ docs\(archive\):/.test(l) && l.toLowerCase().includes(ep.toLowerCase()))
  let alreadyArchived = false
  let archiveReverted = false
  if (archiveHit) {
    alreadyArchived = true
    const revertHit = lines(mainLog).find(
      (l) => /^\S+ Revert "docs\(archive\)/.test(l) && l.toLowerCase().includes(ep.toLowerCase()),
    )
    if (revertHit) archiveReverted = true
  }

  const flags = []
  if (flagEntangled) flags.push('entangled_commits_present')
  if (flagRevert) flags.push('revert_commit_present')
  if (flagNoMergeMarker) flags.push('no_merge_marker_found')
  if (alreadyArchived) flags.push('already_archived')
  if (archiveReverted) flags.push('archive_was_reverted')

  const status = flags.length ? 'indeterminate' : 'firm'

  return {
    epic: ep,
    status,
    source: 'history-scan',
    suggestedFirstCommit: suggestedFirst,
    suggestedLastCommit: suggestedLast,
    flags,
    candidates,
  }
}

export function formatResult(result) {
  const out = []
  out.push(`${bold('epic:')} ${result.epic}`)
  out.push(`${bold('status:')} ${statusColor(result.status)}`)
  if (result.status === 'not_found') return out.join('\n') + '\n'
  out.push(`${bold('source:')} ${result.source}`)
  out.push(`${bold('suggested_first_commit:')} ${dim(result.suggestedFirstCommit ?? '')}`)
  out.push(`${bold('suggested_last_commit:')} ${dim(result.suggestedLastCommit ?? '')}`)
  out.push(`${bold('suggested_diff_range:')} ${dim(`${result.suggestedFirstCommit ?? ''}^ ${result.suggestedLastCommit ?? ''}`)}`)
  out.push(emitFlags(result.flags))
  out.push('---------------------------')
  for (const c of result.candidates ?? []) {
    out.push('*****')
    const marker = c.isRevert ? red('is_revert=yes') : `is_revert=${dim('no')}`
    const also = c.alsoTouches.length ? yellow(`also_touches=${c.alsoTouches.join(',')}`) : dim('also_touches=')
    out.push(
      `${bold('candidate:')} ${dim(c.sha)} ${c.date} is_add=${c.isAdd ? 'yes' : dim('no')} ${marker} ${also} subject=${c.subject}`,
    )
  }
  out.push('---------------------------')
  return out.join('\n') + '\n'
  
}

export function main(argv) {
  const ep = argv[0]
  if (!ep) {
    console.error('Usage: epic-commit-range.sh <EP_NUMBER>')
    process.exit(1)
  }
  const root = gitToplevel()
  const result = epicCommitRange(root, ep)
  return formatResult(result)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(main(process.argv.slice(2)))
}
