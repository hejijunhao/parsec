import fg from 'fast-glob'
import { readFile, access } from 'fs/promises'
import { resolve } from 'path'

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

  try {
    await access(basePath)
  } catch {
    throw new Error(`Codebase path does not exist or is not accessible: ${config.path}`)
  }

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
