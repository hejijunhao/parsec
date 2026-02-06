export const definition = {
  name: 'query_database',
  description: 'Execute a read-only SQL query against the connected database',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL SELECT query' }
    },
    required: ['query']
  }
}

export async function execute(input, config) {
  // TODO: implement with pg client
  // - Connect using config.connectionString
  // - Run read-only query (SET TRANSACTION READ ONLY)
  // - Return rows
  throw new Error('Database tool not yet implemented')
}
