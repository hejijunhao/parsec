import pg from 'pg'

const ALLOWED_PREFIXES = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW']
const QUERY_TIMEOUT_MS = 30000
const CONNECTION_TIMEOUT_MS = 10000
const DEFAULT_ROW_LIMIT = 500

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

function validateQuery(query) {
  const trimmed = query.trim().replace(/;\s*$/, '')
  const normalized = trimmed.toUpperCase()

  if (!ALLOWED_PREFIXES.some(p => normalized.startsWith(p))) {
    throw new Error('Only read-only queries are allowed (SELECT, WITH, EXPLAIN, SHOW)')
  }

  if (trimmed.includes(';')) {
    throw new Error('Multiple statements are not allowed')
  }

  return trimmed
}

function applyRowLimit(query) {
  if (!/LIMIT\s+\d+/i.test(query)) {
    return `${query} LIMIT ${DEFAULT_ROW_LIMIT}`
  }
  return query
}

export async function execute(input, config) {
  const validated = validateQuery(input.query)

  const query = applyRowLimit(validated)
  const client = new pg.Client({
    connectionString: config.connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  })

  try {
    await client.connect()
    await client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`)
    await client.query('BEGIN TRANSACTION READ ONLY')
    const result = await client.query(query)
    await client.query('COMMIT')
    return { rows: result.rows, rowCount: result.rowCount }
  } catch (err) {
    throw new Error(`Database query failed: ${err.message}`)
  } finally {
    await client.end().catch(() => {})
  }
}
