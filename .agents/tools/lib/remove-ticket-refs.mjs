#!/usr/bin/env node
/**
 * Removes ticket ID references from comments while preserving descriptive content.
 * Usage: remove-ticket-refs.mjs <package-path>
 * Example: remove-ticket-refs.mjs packages/srs-engine
 */

import fs from 'fs';
import { execSync } from 'child_process';

const packagePath = process.argv[2];
if (!packagePath) {
  console.error('Usage: remove-ticket-refs.mjs <package-path>');
  console.error('Example: remove-ticket-refs.mjs packages/srs-engine');
  process.exit(1);
}

function removeTicketRefs(content) {
  return content.split('\n').map(line => {
    // Skip TODO: lines — they intentionally track ticket references
    if (/^\s*(\/\/|\/?\*)\s*TODO\s*:/.test(line)) {
      return line;
    }

    return line
      // Pattern 1: "/** TicketID: description */" → "/** description */"
      .replace(/^(.*?)(\/\*\*\s*\b(EP\d+(-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+)\b:\s*)/, (_, prefix) => prefix + '/** ')
      // Pattern 2: "// TicketID: description" → "// description"
      .replace(/^(\s*\/\/)\s+\b(EP\d+(-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+)\b:\s*/g, '$1 ')
      // Pattern 3: "// TicketID description" → "// description" (only at line start)
      .replace(/^(\s*\/\/)\s+\b(EP\d+(-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+)\b\s+/gm, '$1 ')
      // Pattern 4: Remove " (TicketID §x)" or " (unchanged from TicketID)" style references
      .replace(/\s+\(\s*(?:unchanged from\s+)?(EP\d+(?:-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+)\s*(?:§\d+)?\s*\)/g, '')
      // Pattern 5: Remove references like " ST07/ST08" in comments after "from" or similar
      .replace(/\s+(?:from\s+)?(EP\d+(?:-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+)(?:\/(EP\d+(?:-[A-Z]+\d+)?|PH\d+|DS\d+|ST\d+|BUG\d+))*(?=\)|\s|$)/g, '')
      // Pattern 6: Remove orphaned "(unchanged)" left after stripping ticket refs
      .replace(/\s+\(\s*unchanged\s*\)/g, '');
  }).join('\n');
}

// Find all TypeScript/JavaScript files in the package
const findCmd = `find "${packagePath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) 2>/dev/null`;
const files = execSync(findCmd, { encoding: 'utf-8' }).split('\n').filter(Boolean);

let fixed = 0;
let skipped = 0;

files.forEach((file) => {
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
