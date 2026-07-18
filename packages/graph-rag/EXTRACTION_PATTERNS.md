# Knowledge Graph: Extraction Patterns Reference

This document shows exactly how data is extracted from your `.agents/` markdown files and turned into graph nodes/edges.

## Data Source 1: Epic Plans (`.agents/plans/epics/`)

### File Format
```
.agents/plans/epics/EP01-monorepo-scaffolding.md
.agents/plans/epics/EP02-srs-engine-mastery.md
...
```

### Extraction Pattern 1: Episode Node from Filename

**Pattern**:
```
EP(\d+) → Episode ID
EP\d+-(.+?)\.md → Episode Title
```

**Example**:
```
File: EP01-monorepo-scaffolding.md
    ↓
regex: /EP(\d+)/
    ↓
Result: id = "EP01"
Result: title = "monorepo scaffolding"
Result: label = "EP01: monorepo scaffolding"
```

**Code**:
```typescript
const episodeMatch = epicFile.match(/EP(\d+)/);
const episodeNum = `EP${episodeMatch[1]}`;  // "EP01"

const titleMatch = epicFile.match(/EP\d+-(.+?)\.md/);
const title = titleMatch[1].replace(/-/g, ' ');  // "monorepo scaffolding"
```

### Extraction Pattern 2: Problem Statement

**Markdown pattern**:
```markdown
## Problem Statement

No project structure exists. All Stage 1 work (and every subsequent stage) 
requires a working monorepo with shared tooling before any package can be built.

## Scope
```

**Regex**:
```typescript
/## Problem Statement\n\n([\s\S]*?)\n\n/
```

**Breakdown**:
- `## Problem Statement` - literal match
- `\n\n` - two newlines
- `([\s\S]*?)` - capture group: any chars (incl. newlines), non-greedy
- `\n\n` - two newlines (stop here)

**Result**:
```typescript
metadata.problem = "No project structure exists. All Stage 1..."
```

**Example match**:
```
Match: "## Problem Statement\n\nNo project structure exists...\n\n"
Captured group 1: "No project structure exists..."
```

### Extraction Pattern 3: Dependencies

**Markdown pattern**:
```markdown
**Depends on**: N/A
```

or

```markdown
**Depends on**: EP01, EP02, EP03
```

**Regex**:
```typescript
/\*\*Depends on\*\*:\s*(.*?)\n/
```

**Breakdown**:
- `\*\*Depends on\*\*` - literal "**Depends on**"
- `:` - colon
- `\s*` - optional whitespace
- `(.*?)` - capture: dependency list, non-greedy
- `\n` - newline (stop here)

**Parsing**:
```typescript
const depMatch = content.match(/\*\*Depends on\*\*:\s*(.*?)\n/);
const dependencies = depMatch[1]
  .split(/[,\/]/)               // Split on comma or slash
  .map((d) => d.trim())         // Remove whitespace
  .filter((d) => 
    d && 
    d !== 'N/A' &&             // Filter out "N/A"
    d !== 'N' &&               // Filter out lone "N"
    d !== 'A'                  // Filter out lone "A"
  );
```

**Examples**:
```
Input: "EP01, EP02"
Split: ["EP01", " EP02"]
Map: ["EP01", "EP02"]
Result: ["EP01", "EP02"]

Input: "N/A"
Split: ["N", "/", "A"]
Filter: []
Result: []

Input: "EP20"
Result: ["EP20"]
```

### Extraction Pattern 4: Stories

**Markdown pattern**:
```markdown
### EP01-ST01: pnpm workspace + Turborepo

**Scope**: Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`...

### EP01-ST02: Root tsconfig + ESLint flat config

**Scope**: `tsconfig.json` (strict base)...
```

**Regex**:
```typescript
/### (EP\d+-ST\d+):\s*(.+?)\n/g
```

**Breakdown**:
- `### ` - literal three hashes + space
- `(EP\d+-ST\d+)` - capture: story ID (EP##-ST##)
- `:` - colon
- `\s*` - optional whitespace
- `(.+?)` - capture: story title, non-greedy
- `\n` - newline

**Parsing** (uses global regex with loop):
```typescript
const storyRegex = /### (EP\d+-ST\d+):\s*(.+?)\n/g;
let storyMatch;
while ((storyMatch = storyRegex.exec(content))) {
  const storyId = storyMatch[1];      // "EP01-ST01"
  const storyTitle = storyMatch[2];   // "pnpm workspace + Turborepo"
  
  graph.addNode({
    id: storyId,
    type: 'story',
    label: `${storyId}: ${storyTitle}`,
    metadata: { episode: episodeNum }
  });
  
  graph.addEdge({
    from: episodeNum,
    to: storyId,
    type: 'contains',
    label: 'contains story'
  });
}
```

**Result** (per epic with 3 stories):
```
Nodes added:
  - EP01-ST01: pnpm workspace + Turborepo
  - EP01-ST02: Root tsconfig + ESLint flat config
  - EP01-ST03: Vitest workspace + srs-engine package scaffold

Edges added:
  - EP01 → [contains] → EP01-ST01
  - EP01 → [contains] → EP01-ST02
  - EP01 → [contains] → EP01-ST03
```

---

## Data Source 2: Changelogs (`.agents/changelogs/EP##--*/`)

### File Format
```
.agents/changelogs/EP01--monorepo-scaffolding/
├── 20260305T000000Z-EP01-ST03-vitest-workspace-srs-engine-scaffold.md
├── 20260305T200100Z-DS01-monorepo-scaffolding.md
├── 20260305T210000Z-ST01-pnpm-workspace-turborepo.md
└── 20260305T220000Z-ST02-tsconfig-eslint.md

.agents/changelogs/EP02--srs-engine-mastery/
├── 20260305T234900Z-EP02-ST01-engine-types.md
├── 20260305T235600Z-EP02-ST02-mastery-counting.md
...
```

### Extraction Pattern 1: Episode ID from Directory

**Pattern**:
```
EP(\d+)--.*  → Episode ID
```

**Example**:
```
Directory: EP01--monorepo-scaffolding
    ↓
regex: /EP(\d+)/
    ↓
Result: id = "EP01"
```

**Code**:
```typescript
const episodeDirs = readdirSync(changelogsDir).filter((f) => f.startsWith('EP'));
for (const episodeDir of episodeDirs) {
  const episodeMatch = episodeDir.match(/EP(\d+)/);
  const episodeNum = `EP${episodeMatch[1]}`;  // "EP01"
}
```

### Extraction Pattern 2: Design Spec ID from Filename

**Pattern**:
```
{timestamp}?-?(DS\d+)?-.*\.md
```

**Examples**:
```
20260305T200100Z-DS01-monorepo-scaffolding.md
    ↓
Match groups: (?:, "DS01", ...)
Result: designSpecId = "DS01"

20260305T000000Z-EP01-ST03-vitest-workspace.md
    ↓
Match groups: ("20260305T000000Z", undefined, ...)
Result: designSpecId = undefined (not a spec file)
```

**Code**:
```typescript
const dsMatch = file.match(/(\d{8}T\d{6}Z)?-?(DS\d+)?-/);
const designSpecId = dsMatch && dsMatch[2] ? dsMatch[2] : null;

if (designSpecId) {
  graph.addNode({
    id: designSpecId,
    type: 'design-spec',
    label: designSpecId,
    metadata: { episode: episodeNum, file }
  });
  
  graph.addEdge({
    from: designSpecId,
    to: episodeNum,
    type: 'defines',
    label: 'defines'
  });
}
```

**Result**:
```
File: 20260305T200100Z-DS01-monorepo-scaffolding.md
Nodes: DS01 (design-spec)
Edges: DS01 → [defines] → EP01
```

### Extraction Pattern 3: Files Modified

**Markdown pattern**:
```markdown
## Files Modified

### `vitest.workspace.ts` (new)

- Root workspace config pointing Vitest to `packages/*/vitest.config.ts`

### `packages/srs-engine/package.json` (new)

- `@gll/srs-engine` package — ESM, private, devDeps with version ranges

### `packages/srs-engine/tsconfig.json` (new)

- Extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`

## Behavior Preserved / New Behavior
```

**Regex**:
```typescript
/## Files Modified\n\n([\s\S]*?)(?=##|$)/
```

Then within that section:
```typescript
/### `([^`]+)`/g
```

**Breakdown**:
- `## Files Modified\n\n` - literal section header
- `([\s\S]*?)` - capture all content until...
- `(?=##|$)` - lookahead: next ## or end of string

**Parsing**:
```typescript
const filesSection = content.match(/## Files Modified\n\n([\s\S]*?)(?=##|$)/);
if (filesSection) {
  const fileMatches = filesSection[1].match(/### `([^`]+)`/g);
  if (fileMatches) {
    fileMatches.forEach((match) => {
      const filePath = match.replace(/### `|`/g, '');  // Remove markers
      const fileId = `file:${filePath}`;
      
      graph.addNode({
        id: fileId,
        type: 'component',
        label: filePath,
        metadata: { type: 'file' }
      });
      
      graph.addEdge({
        from: episodeNum,
        to: fileId,
        type: 'modified',
        label: 'modified'
      });
    });
  }
}
```

**Example**:
```
Input section:
"### `vitest.workspace.ts` (new)\n\n- Root workspace config..."

Regex /### `([^`]+)`/
Match: "### `vitest.workspace.ts`"
Captured group 1: "vitest.workspace.ts"

After remove markers: "vitest.workspace.ts"
File ID: "file:vitest.workspace.ts"

Result node:
{
  id: "file:vitest.workspace.ts",
  type: "component",
  label: "vitest.workspace.ts",
  metadata: { type: "file" }
}

Result edge:
{
  from: "EP01",
  to: "file:vitest.workspace.ts",
  type: "modified",
  label: "modified"
}
```

### Extraction Pattern 4: Spec Corrections

**Markdown pattern**:
```markdown
## DS01 Spec Gaps Corrected

| Gap | DS01 Said | Actual / Fix |
|-----|-----------|-------------|
| `devDependencies` protocol | `"typescript": "workspace:*"` | `"typescript": "^5.7"` |
| tsconfig `include` | `["src/**/*", "__tests__/**/*"]` | `["src/**/*"]` |

## Next Steps
```

**Regex**:
```typescript
/## .*Spec Gaps Corrected([\s\S]*?)(?=##|$)/
```

**Code**:
```typescript
const correctionsSection = content.match(/## .*Spec Gaps Corrected([\s\S]*?)(?=##|$)/);
if (correctionsSection && designSpecId) {
  graph.addEdge({
    from: episodeNum,
    to: designSpecId,
    type: 'corrected-from',
    label: 'corrected spec'
  });
}
```

**Result**:
```
If corrections found:
Edge: EP01 → [corrected-from] → DS01

(Indicates: EP01 corrected spec DS01 during implementation)
```

---

## Summary: How to Extend

### Add a New Extraction Type

Example: Extract "Lessons Learned" section

**Step 1: Update markdown in epics/changelogs**
```markdown
## Lessons Learned

- Workspace:* only works for internal packages, not external deps
- Vitest passWithNoTests flag needed for no-test exit code
- TypeScript strict mode caught 3 edge cases before runtime
```

**Step 2: Add extraction pattern in `src/ingestion.ts`**
```typescript
// In ingestEpics() or ingestChangelogs():
const lessonsMatch = content.match(/## Lessons Learned\n\n([\s\S]*?)(?=##|$)/);
if (lessonsMatch) {
  const lessons = lessonsMatch[1]
    .split('\n-')
    .map(l => l.trim())
    .filter(l => l);
  
  lessons.forEach((lesson, idx) => {
    const lessonId = `${episodeNum}-LESSON-${idx}`;
    graph.addNode({
      id: lessonId,
      type: 'decision',  // or new type 'lesson'
      label: lesson,
      metadata: { episode: episodeNum }
    });
    
    graph.addEdge({
      from: episodeNum,
      to: lessonId,
      type: 'learns',
      label: 'learns'
    });
  });
}
```

**Step 3: Reseed the graph**
```bash
pnpm --filter @gll/graph-rag ingest
```

**Result**: New nodes extracted, queryable immediately

### Common Patterns

**Extract numbered lists**:
```typescript
const items = section.split(/^\d+\.\s+/m).filter(x => x);
```

**Extract tables**:
```typescript
const rows = section.split('\n|').filter(r => r.includes('|'));
```

**Extract highlighted blocks** (warning, note, etc):
```typescript
const blocks = content.match(/^> (.*?)$/gm);
```

**Extract code blocks**:
```typescript
const codeBlocks = content.match(/```(?:typescript|typescript)?\n([\s\S]*?)\n```/g);
```

---

## Testing Your Patterns

Create a test file to verify regex patterns work:

```typescript
// test-patterns.ts
const testContent = `
## Problem Statement

Test problem text here.

## Scope

Test scope.
`;

const problemMatch = testContent.match(/## Problem Statement\n\n([\s\S]*?)\n\n/);
console.log(problemMatch[1]);  // "Test problem text here."
```

Run:
```bash
npx tsx test-patterns.ts
```

---

## Performance Notes

**Regex complexity**: All patterns are linear (no backtracking)
**Ingest time**: ~90ms for 189 files
**Scalability**: Patterns remain O(n) even at 1000+ files

If ingestion gets slow, profile with:
```typescript
console.time('ingestEpics');
this.ingestEpics(graph);
console.timeEnd('ingestEpics');
```
