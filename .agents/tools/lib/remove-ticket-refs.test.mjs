import { strict as assert } from 'assert';

/**
 * Test cases for remove-ticket-refs patterns.
 * Run: node --test remove-ticket-refs.test.mjs
 */

// Match the actual removeTicketRefs function from remove-ticket-refs.mjs
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

console.log('Testing remove-ticket-refs patterns...\n');

// Test 1: Block comment with colon-separated ticket ID
console.log('Test 1: Block comment with ticket ID and colon');
const test1 = '/** DS03: core review loop. */';
const expect1 = '/** core review loop. */';
const result1 = removeTicketRefs(test1);
assert.equal(result1, expect1, `Expected "${expect1}" but got "${result1}"`);
console.log(`✓ "${test1}" → "${result1}"\n`);

// Test 2: Line comment with colon-separated ticket ID
console.log('Test 2: Line comment with colon');
const test2 = '// DS02: shelving pipeline logic';
const expect2 = '// shelving pipeline logic';
const result2 = removeTicketRefs(test2);
assert.equal(result2, expect2, `Expected "${expect2}" but got "${result2}"`);
console.log(`✓ "${test2}" → "${result2}"\n`);

// Test 3: Line comment with space-separated ticket ID
console.log('Test 3: Line comment with space separation');
const test3 = '// ST07 core review loop. For each due card...';
const expect3 = '// core review loop. For each due card...';
const result3 = removeTicketRefs(test3);
assert.equal(result3, expect3, `Expected "${expect3}" but got "${result3}"`);
console.log(`✓ "${test3}" → "${result3}"\n`);

// Test 4: Parenthesized reference with section number (as doc comment)
console.log('Test 4: Doc comment with parenthesized reference');
const test4 = '/** App-layer mapping (DS03 §3). */';
const expect4 = '/** App-layer mapping. */';
const result4 = removeTicketRefs(test4);
assert.equal(result4, expect4, `Expected "${expect4}" but got "${result4}"`);
console.log(`✓ "${test4}" → "${result4}"\n`);

// Test 5: "unchanged from" pattern
console.log('Test 5: Unchanged from pattern');
const test5 = '// updateRunState — cumulative fields (unchanged from ST07/ST08)';
const expect5 = '// updateRunState — cumulative fields';
const result5 = removeTicketRefs(test5);
assert.equal(result5, expect5, `Expected "${expect5}" but got "${result5}"`);
console.log(`✓ "${test5}" → "${result5}"\n`);

// Test 6: Complex ticket ID like EP42-DS01
console.log('Test 6: Complex ticket ID (EP42-DS01)');
const test6 = '/** EP42-DS01: audio playback markers. */';
const expect6 = '/** audio playback markers. */';
const result6 = removeTicketRefs(test6);
assert.equal(result6, expect6, `Expected "${expect6}" but got "${result6}"`);
console.log(`✓ "${test6}" → "${result6}"\n`);

// Test 7: Orphaned (unchanged) cleanup
console.log('Test 7: Orphaned (unchanged) cleanup');
const test7 = '// fields (unchanged)';
const expect7 = '// fields';
const result7 = removeTicketRefs(test7);
assert.equal(result7, expect7, `Expected "${expect7}" but got "${result7}"`);
console.log(`✓ "${test7}" → "${result7}"\n`);

// Test 8: No changes needed
console.log('Test 8: No ticket refs (no changes)');
const test8 = '// This is a regular comment with no ticket refs';
const expect8 = '// This is a regular comment with no ticket refs';
const result8 = removeTicketRefs(test8);
assert.equal(result8, expect8, `Expected "${expect8}" but got "${result8}"`);
console.log(`✓ "${test8}" → "${result8}"\n`);

// Test 9: TODO: comments should be preserved (with colon)
console.log('Test 9: TODO: comments (preserved — with colon)');
const test9 = '// TODO: (EP42) Fix audio playback';
const expect9 = '// TODO: (EP42) Fix audio playback';
const result9 = removeTicketRefs(test9);
assert.equal(result9, expect9, `Expected "${expect9}" but got "${result9}"`);
console.log(`✓ "${test9}" → "${result9}"\n`);

// Test 10: TODO without colon should be processed
console.log('Test 10: TODO comment without colon (ticket ref removed)');
const test10 = '// TODO (EP42) Fix audio playback';
const expect10 = '// TODO Fix audio playback';
const result10 = removeTicketRefs(test10);
assert.equal(result10, expect10, `Expected "${expect10}" but got "${result10}"`);
console.log(`✓ "${test10}" → "${result10}"\n`);

console.log('✨ All tests passed!\n');
console.log('Usage:');
console.log('  .agents/tools/remove-ticket-refs.sh packages/srs-engine');
console.log('  .agents/tools/remove-ticket-refs.sh apps/server');
