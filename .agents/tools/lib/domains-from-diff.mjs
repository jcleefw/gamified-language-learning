// .agents/tools/lib/domains-from-diff.mjs
// Implementation behind domains-from-diff.sh. Routes changed paths to
// workspace units deterministically. See domains-from-diff.sh for the CLI
// contract (usage, output format).
//
// The domain taxonomy is pnpm-workspace.yaml: every apps/* and packages/* is
// a domain. This never hardcodes the unit list — it reads globs from
// pnpm-workspace.yaml, so adding a package is automatically included with
// zero edits here. Paths in, workspace units out.
//
// Zero npm deps.

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

function die(msg, code = 1) {
  console.error(msg)
  process.exit(code)
}

function gitToplevel() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

// Parse the `packages:` list from pnpm-workspace.yaml → literal glob prefixes.
// Not a general YAML parser — mirrors the bash version's awk scope exactly:
// only a top-level `packages:` block of `- 'glob'` list items.
export function workspacePrefixes(yamlText) {
  const lines = yamlText.split(/\r?\n/)
  const globs = []
  let inSection = false
  for (const line of lines) {
    if (/^[^\s#]/.test(line)) {
      inSection = /^packages:\s*$/.test(line)
      continue
    }
    if (!inSection) continue
    const m = line.match(/^\s*-\s*(.*)$/)
    if (!m) continue
    const glob = m[1].replace(/["']/g, '').replace(/\s+$/, '')
    if (glob !== '') globs.push(glob)
  }
  return globs.map((glob) => glob.replace(/\*.*$/, '')) // 'packages/*' → 'packages/'
}

export function routeDomains(files, prefixes) {
  const units = new Set()
  let nonWorkspace = false
  for (const file of files) {
    let matched = false
    for (const prefix of prefixes) {
      if (prefix && file.startsWith(prefix)) {
        const rest = file.slice(prefix.length)
        const seg = rest.split('/')[0]
        if (seg) {
          units.add(`${prefix}${seg}`)
          matched = true
          break
        }
      }
    }
    if (!matched) nonWorkspace = true
  }
  const sorted = [...units].sort()
  if (nonWorkspace) sorted.push('<non-workspace>')
  return sorted
}

function collectFiles(root, argv) {
  if (argv[0] === '--files') return argv.slice(1).filter((f) => f !== '')
  if (argv[0] === '--stdin') {
    const raw = readFileSync(0, 'utf8')
    return raw.split(/\r?\n/).filter((f) => f !== '')
  }
  if (argv.length === 0) {
    die('Error: no arguments. Pass git diff args, --files <paths>, or --stdin.', 2)
  }
  const out = execFileSync('git', ['-C', root, 'diff', '--name-only', ...argv], { encoding: 'utf8' })
  return out.split(/\r?\n/).filter((f) => f !== '')
}

export function main(argv) {
  const root = gitToplevel()
  const workspaceFile = join(root, 'pnpm-workspace.yaml')
  let yamlText
  try {
    yamlText = readFileSync(workspaceFile, 'utf8')
  } catch {
    die(`Error: ${workspaceFile} not found (needed for the domain taxonomy, D1).`)
  }

  const files = collectFiles(root, argv)
  if (files.length === 0) return '' // nothing changed → no domains

  const prefixes = workspacePrefixes(yamlText)
  if (prefixes.length === 0) {
    die(`Error: no package globs found under 'packages:' in ${workspaceFile}.`)
  }

  const domains = routeDomains(files, prefixes)
  return domains.length ? domains.join('\n') + '\n' : ''
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = main(process.argv.slice(2))
  if (out) process.stdout.write(out)
}
