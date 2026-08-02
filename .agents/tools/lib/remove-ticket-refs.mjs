#!/usr/bin/env node
/**
 * Removes ticket ID references from comments while preserving descriptive content.
 * Usage: remove-ticket-refs.mjs <package-path>
 *        remove-ticket-refs.mjs <file...>   (e.g. from lint-staged)
 * Example: remove-ticket-refs.mjs packages/srs-engine
 */

import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TICKET_ABBREVIATIONS } from '../../../eslint-rules/ticket-ref-pattern.ts';

// Same abbreviation list the eslint rule matches against (eslint-rules/ticket-ref-pattern.ts) —
// kept as one source of truth so this script and the rule can't drift apart.
const REF = `(?:${TICKET_ABBREVIATIONS})-?\\d+(?:-(?:${TICKET_ABBREVIATIONS})-?\\d+)*`;

export function removeTicketRefs(content) {
  return content.split('\n').map(line => {
    // Skip TODO: lines — they intentionally track ticket references
    if (/^\s*(\/\/|\/?\*)\s*TODO\s*:/.test(line)) {
      return line;
    }

    return line
      // Pattern 1: "/** TicketID: description */" → "/** description */"
      .replace(new RegExp(`^(.*?)(/\\*\\*\\s*\\b${REF}\\b:\\s*)`), (_, prefix) => prefix + '/** ')
      // Pattern 2: "// TicketID: description" → "// description"
      .replace(new RegExp(`^(\\s*//)\\s+\\b${REF}\\b:\\s*`, 'g'), '$1 ')
      // Pattern 3: "// TicketID description" → "// description" (only at line start)
      .replace(new RegExp(`^(\\s*//)\\s+\\b${REF}\\b\\s+`, 'gm'), '$1 ')
      // Pattern 4: Remove " (TicketID §x)" or " (unchanged from TicketID)" style references
      .replace(new RegExp(`\\s+\\(\\s*(?:unchanged from\\s+)?${REF}\\s*(?:§\\d+)?\\s*\\)`, 'g'), '')
      // Pattern 5: Remove references like " ST07/ST08" in comments after "from" or similar
      .replace(new RegExp(`\\s+(?:from\\s+)?${REF}(?:/${REF})*(?=\\)|\\s|$)`, 'g'), '')
      // Pattern 6: Remove orphaned "(unchanged)" left after stripping ticket refs
      .replace(/\s+\(\s*unchanged\s*\)/g, '');
  }).join('\n');
}

function isDirectory(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function main(args) {
  if (args.length === 0) {
    console.error('Usage: remove-ticket-refs.mjs <package-path>');
    console.error('       remove-ticket-refs.mjs <file...>');
    console.error('Example: remove-ticket-refs.mjs packages/srs-engine');
    process.exit(1);
  }

  // A single directory argument (bulk mode) walks the package; otherwise treat
  // args as an explicit file list (e.g. staged files from lint-staged).
  const files =
    args.length === 1 && isDirectory(args[0])
      ? execSync(
          `find "${args[0]}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.vue" \\) 2>/dev/null`,
          { encoding: 'utf-8' },
        )
          .split('\n')
          .filter(Boolean)
      : args;

  let fixed = 0;
  let skipped = 0;

  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const fixed_content = removeTicketRefs(content);

      if (content !== fixed_content) {
        fs.writeFileSync(file, fixed_content, 'utf-8');
        console.log(`✓ ${file}`);
        fixed++;
      }
    } catch (err) {
      console.error(`⚠ Error processing ${file}: ${err.message}`);
      skipped++;
    }
  });

  console.log(`\n✨ Fixed ${fixed} files, skipped ${skipped}.`);
}

// Only run the CLI when this file is executed directly, not when imported (e.g. by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
