// .agents/tools/lib/style.mjs
// Shared terminal styling for the archive-epic tool family. Colors only when
// stdout is a real TTY — piped output (tests, SKILL.md parsing, `| head`,
// redirects) stays plain text so the CLI contract (byte-for-byte stdout) is
// unaffected. Zero npm deps — node:util's styleText is Node >=20 built-in.

import { styleText } from 'node:util'

const enabled = process.stdout.isTTY && process.env.NO_COLOR === undefined

function style(format, text) {
  return enabled ? styleText(format, text) : text
}

export const bold = (s) => style('bold', s)
export const dim = (s) => style('dim', s)
export const green = (s) => style('green', s)
export const yellow = (s) => style('yellow', s)
export const red = (s) => style('red', s)
export const cyan = (s) => style('cyan', s)

// status: firm | indeterminate | not_found → green | yellow | red
export function statusColor(status) {
  if (status === 'firm') return green(status)
  if (status === 'indeterminate') return yellow(status)
  if (status === 'not_found') return red(status)
  return status
}
