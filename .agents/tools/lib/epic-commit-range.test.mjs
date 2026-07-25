// Parity + unit tests for the epic-commit-range bash → mjs port (AGN07-ST02).
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { epicCommitRange, formatResult } from './epic-commit-range.mjs'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

let origPath

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'epic-commit-range-orig-'))
  const origSrc = execFileSync('git', ['-C', ROOT, 'show', 'HEAD:.agents/tools/epic-commit-range.sh'], {
    encoding: 'utf8',
  })
  origPath = join(dir, 'epic-commit-range.orig.sh')
  writeFileSync(origPath, origSrc, { mode: 0o755 })
})

function runOrig(ep) {
  return execFileSync('bash', [origPath, ep], { encoding: 'utf8', cwd: ROOT })
}

function runNew(ep) {
  return formatResult(epicCommitRange(ROOT, ep))
}

// Strip ANSI escapes and collapse blank lines — the mjs port intentionally
// adds terminal styling (color, spacing around candidate: lines) that the
// original bash never had. What must stay identical is the actual content
// (key:value pairs, candidate fields), not incidental whitespace/color.
function normalize(text) {
  return text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((l) => l !== '')
    .join('\n')
}

// Epics known (as of this port) to exercise each status/flag path:
// EP01 — already archived + compacted (already_archived, no_merge_marker_found, possibly entangled)
// EP11 — has a live changelog folder, real history (indeterminate case observed above)
// EP999 — never existed (not_found)
describe('epic-commit-range parity: bash vs mjs (content, ignoring color/spacing)', () => {
  it('an already-archived epic (EP01)', () => {
    expect(normalize(runNew('EP01'))).toBe(normalize(runOrig('EP01')))
  })

  it('an epic with a live changelog folder (EP11)', () => {
    expect(normalize(runNew('EP11'))).toBe(normalize(runOrig('EP11')))
  })

  it('an epic with no matching commits at all (not_found)', () => {
    expect(normalize(runNew('EP999'))).toBe(normalize(runOrig('EP999')))
  })

  it('AGN06 — an agentic-track id', () => {
    expect(normalize(runNew('AGN06'))).toBe(normalize(runOrig('AGN06')))
  })
})

describe('epicCommitRange (unit)', () => {
  it('not_found shape has no candidates/flags fields required by formatResult', () => {
    const result = epicCommitRange(ROOT, 'EP999')
    expect(result.status).toBe('not_found')
    expect(formatResult(result)).toBe('epic: EP999\nstatus: not_found\n')
  })

  it('firm/indeterminate results always carry a source and flags array', () => {
    const result = epicCommitRange(ROOT, 'EP01')
    expect(['firm', 'indeterminate']).toContain(result.status)
    expect(Array.isArray(result.flags)).toBe(true)
    expect(['history-scan', 'branch-divergence']).toContain(result.source)
  })
})
