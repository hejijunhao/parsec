export const definition = {
  name: 'search_codebase',
  description: 'Search for files or code patterns in the connected codebase',
  input_schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (glob or regex)' },
      content_search: { type: 'string', description: 'Search within file contents' }
    }
  }
}

export async function execute(input, config) {
  // TODO: implement with fs/child_process
  // - Use config.path as the root directory
  // - Match files by glob pattern
  // - Optionally grep file contents
  // - Return matching files/lines
  throw new Error('Codebase tool not yet implemented')
}
