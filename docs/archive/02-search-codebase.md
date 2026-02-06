# 02 — Implement `search_codebase` Tool

**File:** `backend/src/tools/codebase.js`
**New dependency:** `fast-glob` (needs `npm install fast-glob`)
**Parallel:** Yes — no dependency on other workstreams

---

## Current State

The file exports a `definition` (tool schema) and an `execute` function that throws `"Codebase tool not yet implemented"`. The schema accepts two optional parameters: `pattern` (glob/regex for file names) and `content_search` (search within file contents).

The tool dispatcher passes `connectors.codebase` as the config object, which has the shape:

```js
{ path: '/path/to/repo' }
```

---

## Implementation Plan

### Phase 1: File pattern matching with `fast-glob`

**Goal:** Given a glob pattern and a root directory, return matching file paths.

Steps:

1. `cd backend && npm install fast-glob`
2. Import `fast-glob` (as `fg`) at the top of `codebase.js`
3. In `execute(input, config)`:
   a. Resolve the base directory from `config.path`
   b. If `input.pattern` is provided, use `fg` to match files under the base directory
   c. Return the list of matching file paths (relative to the base directory for readability)

```js
import fg from 'fast-glob'
import path from 'path'

// If pattern provided, find matching files
const pattern = input.pattern || '**/*'
const files = await fg(pattern, {
  cwd: config.path,
  dot: false,           // skip dotfiles by default
  ignore: ['**/node_modules/**', '**/.git/**'],
  onlyFiles: true,
})
```

### Phase 2: Content search within matched files

**Goal:** If `content_search` is provided, read each matched file and find lines matching the search string.

Steps:

1. Import `fs/promises` and `readline` or just use `fs.readFileSync` for simplicity
2. After getting the file list from Phase 1:
   a. If `input.content_search` is provided, iterate through matched files
   b. Read each file, split into lines, find lines matching the content search pattern
   c. Treat `content_search` as a case-insensitive substring match (simpler and safer than regex from untrusted input)
   d. Collect results as `{ file, line, lineNumber, content }` objects

```js
import { readFile } from 'fs/promises'

const matches = []
for (const file of files) {
  const fullPath = path.join(config.path, file)
  const content = await readFile(fullPath, 'utf-8')
  const lines = content.split('\n')
  const searchLower = input.content_search.toLowerCase()

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(searchLower)) {
      matches.push({
        file,
        lineNumber: i + 1,
        content: lines[i].trimEnd(),
      })
    }
  }
}
```

### Phase 3: Safety & limits

**Goal:** Prevent path traversal, massive result sets, and reading binary files.

Steps:

1. **Path traversal protection:** Resolve the full path of the base directory and verify all matched file paths stay within it. Reject if `config.path` contains `..` sequences that escape the intended root:
   ```js
   import { resolve } from 'path'

   const basePath = resolve(config.path)
   // After matching, verify each file:
   const fullPath = resolve(basePath, file)
   if (!fullPath.startsWith(basePath)) {
     continue // skip files that escape the base
   }
   ```

2. **File count limit:** Cap the number of files returned to 100. If more match, truncate and include a note: `"(truncated — 100 of N files shown)"`.

3. **Content search file limit:** Only search content in the first 50 matched files (skip the rest). Reading thousands of files would be too slow.

4. **Line limit per file:** Cap content matches at 20 lines per file.

5. **Skip binary files:** Before reading a file for content search, check if it's likely binary. A simple heuristic: skip files with extensions like `.png`, `.jpg`, `.gif`, `.woff`, `.ttf`, `.ico`, `.zip`, `.tar`, `.gz`, `.pdf`, `.exe`, `.dll`, `.so`, `.wasm`. Alternatively, read the first 512 bytes and check for null bytes.

6. **Default ignores:** Always ignore `node_modules/`, `.git/`, `dist/`, `build/` directories.

### Phase 4: Response formatting

**Goal:** Return results in a format that's useful for Claude to reason about.

Steps:

1. When only file pattern matching (no content search):
   ```js
   return {
     files,
     count: files.length,
     truncated: files.length < totalCount,
     basePath: config.path,
   }
   ```

2. When content search is included:
   ```js
   return {
     matches,
     matchCount: matches.length,
     filesSearched: searchedCount,
     truncated: ...,
     basePath: config.path,
   }
   ```

---

## Final Shape

```js
import fg from 'fast-glob'
import { readFile } from 'fs/promises'
import { resolve, join } from 'path'

const MAX_FILES = 100
const MAX_CONTENT_SEARCH_FILES = 50
const MAX_LINES_PER_FILE = 20
const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.pdf', '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.mp3', '.mp4', '.avi', '.mov', '.webm',
])

export const definition = {
  name: 'search_codebase',
  description: 'Search for files or code patterns in the connected codebase',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'File glob pattern (e.g. "**/*.js", "src/**/*.vue")' },
      content_search: { type: 'string', description: 'Search within file contents (case-insensitive substring match)' }
    }
  }
}

function isBinary(filePath) {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return BINARY_EXTENSIONS.has(ext)
}

export async function execute(input, config) {
  const basePath = resolve(config.path)
  const pattern = input.pattern || '**/*'

  // Find matching files
  const allFiles = await fg(pattern, {
    cwd: basePath,
    dot: false,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
  })

  const totalFileCount = allFiles.length
  const files = allFiles.slice(0, MAX_FILES)

  // If no content search requested, return file list
  if (!input.content_search) {
    return {
      files,
      count: files.length,
      total: totalFileCount,
      truncated: totalFileCount > MAX_FILES,
      basePath,
    }
  }

  // Content search across matched files
  const searchLower = input.content_search.toLowerCase()
  const matches = []
  const filesToSearch = files.filter(f => !isBinary(f)).slice(0, MAX_CONTENT_SEARCH_FILES)
  let filesSearched = 0

  for (const file of filesToSearch) {
    const fullPath = resolve(basePath, file)
    if (!fullPath.startsWith(basePath)) continue  // path traversal guard

    try {
      const content = await readFile(fullPath, 'utf-8')
      filesSearched++
      const lines = content.split('\n')
      let fileMatchCount = 0

      for (let i = 0; i < lines.length && fileMatchCount < MAX_LINES_PER_FILE; i++) {
        if (lines[i].toLowerCase().includes(searchLower)) {
          matches.push({ file, lineNumber: i + 1, content: lines[i].trimEnd() })
          fileMatchCount++
        }
      }
    } catch {
      // Skip unreadable files (permissions, etc.)
    }
  }

  return {
    matches,
    matchCount: matches.length,
    filesSearched,
    totalFilesMatched: totalFileCount,
    basePath,
  }
}
```

---

## Verification

1. **File matching test:** Configure codebase path to the Parsec project itself, ask Claude "What Vue files are in this project?" — should trigger `search_codebase` with pattern `**/*.vue`.

2. **Content search test:** Ask "Find all TODO comments in the code" — should trigger content search for "TODO" and return the known TODOs in the stubs.

3. **Safety test:** Ensure `node_modules/` and `.git/` are excluded from results. Verify path traversal (`../../etc/passwd`) doesn't escape the base directory.

4. **Large repo test:** Point at a large codebase and verify results are truncated at the configured limits.
