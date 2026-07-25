// Parity + unit tests for the domains-from-diff bash → mjs port (AGN07-ST01).
import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { workspacePrefixes, routeDomains } from './domains-from-diff.mjs'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const MJS = join(ROOT, '.agents/tools/lib/domains-from-diff.mjs')

// Original bash body as it existed at HEAD, before the shim swap — the
// parity baseline. Written to a scratch file so both versions run
// side-by-side without touching the now-shimmed .sh in the tree.
let origShaBash

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'domains-from-diff-orig-'))
  const origSrc = execFileSync('git', ['-C', ROOT, 'show', 'HEAD:.agents/tools/domains-from-diff.sh'], {
    encoding: 'utf8',
  })
  origShaBash = join(dir, 'domains-from-diff.orig.sh')
  writeFileSync(origShaBash, origSrc, { mode: 0o755 })
})

function runOrig(args, opts = {}) {
  return execFileSync('bash', [origShaBash, ...args], { encoding: 'utf8', cwd: ROOT, ...opts })
}

function runNew(args, opts = {}) {
  return execFileSync('node', [MJS, ...args], { encoding: 'utf8', cwd: ROOT, ...opts })
}

describe('domains-from-diff parity: bash vs mjs', () => {
  it('--files with a mix of workspace and non-workspace paths', () => {
    const args = [
      '--files',
      'packages/srs-engine/src/index.ts',
      'apps/srs-demo/src/App.vue',
      'packages/srs-engine/src/other.ts',
      '.agents/tools/archive-epic.sh',
      'README.md',
    ]
    expect(runNew(args)).toBe(runOrig(args))
  })

  it('--files with only workspace paths', () => {
    const args = ['--files', 'packages/db/src/index.ts', 'apps/server/src/main.ts']
    expect(runNew(args)).toBe(runOrig(args))
  })

  it('--files with only non-workspace paths', () => {
    const args = ['--files', 'product-documentation/foo.md', '.agents/RULES.md']
    expect(runNew(args)).toBe(runOrig(args))
  })

  it('--stdin mode', () => {
    const input = 'packages/logger/src/index.ts\napps/cli-demo-db/src/main.ts\n'
    expect(runNew(['--stdin'], { input })).toBe(runOrig(['--stdin'], { input }))
  })

  it('empty file list produces empty output', () => {
    expect(runNew(['--files'])).toBe(runOrig(['--files']))
  })

  it('real git diff range (HEAD~1 HEAD) on this repo', () => {
    // Skip cleanly if HEAD~1 doesn't exist (shallow clone / fresh repo).
    try {
      execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD~1'], { stdio: 'ignore' })
    } catch {
      return
    }
    const args = ['HEAD~1', 'HEAD']
    expect(runNew(args)).toBe(runOrig(args))
  })
})

describe('workspacePrefixes (unit)', () => {
  it('parses a simple packages: block', () => {
    const yaml = `packages:\n  - 'packages/*'\n  - 'apps/*'\n\nonlyBuiltDependencies:\n  - better-sqlite3\n`
    expect(workspacePrefixes(yaml)).toEqual(['packages/', 'apps/'])
  })

  it('ignores content outside the packages: section', () => {
    const yaml = `foo:\n  - 'not-a-package/*'\npackages:\n  - 'packages/*'\n`
    expect(workspacePrefixes(yaml)).toEqual(['packages/'])
  })

  it('returns empty for a file with no packages: key', () => {
    expect(workspacePrefixes('foo:\n  - bar\n')).toEqual([])
  })
})

describe('routeDomains (unit)', () => {
  const prefixes = ['packages/', 'apps/']

  it('routes a path to its workspace unit', () => {
    expect(routeDomains(['packages/srs-engine/src/index.ts'], prefixes)).toEqual(['packages/srs-engine'])
  })

  it('dedupes multiple paths in the same unit', () => {
    expect(routeDomains(['packages/db/a.ts', 'packages/db/b.ts'], prefixes)).toEqual(['packages/db'])
  })

  it('flags a path outside all units as <non-workspace>', () => {
    expect(routeDomains(['README.md'], prefixes)).toEqual(['<non-workspace>'])
  })

  it('sorts workspace units first, <non-workspace> last', () => {
    expect(routeDomains(['apps/z/a.ts', 'packages/a/b.ts', 'README.md'], prefixes)).toEqual([
      'apps/z',
      'packages/a',
      '<non-workspace>',
    ])
  })
})
