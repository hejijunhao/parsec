# 01 — Implement `query_database` Tool

**File:** `backend/src/tools/database.js`
**Dependencies:** `pg` (already in package.json)
**Parallel:** Yes — no dependency on other workstreams

---

## Current State

The file exports a `definition` (tool schema) and an `execute` function that throws `"Database tool not yet implemented"`. The schema accepts a single `query` string parameter.

The tool dispatcher (`tools/index.js`) already maps `query_database` to this executor and passes `connectors.database` as the config object, which has the shape:

```js
{ type: 'postgresql', connectionString: 'postgres://...' }
```

---

## Implementation Plan

### Phase 1: Core query execution

**Goal:** Accept a SQL string, run it against the configured PostgreSQL database, return rows.

Steps:

1. Import `pg` at the top of `database.js`
2. In `execute(input, config)`:
   a. Create a new `pg.Client` from `config.connectionString`
   b. Connect to the database
   c. Execute the query from `input.query`
   d. Return the rows as a JSON-serializable object: `{ rows, rowCount }`
   e. Disconnect the client in a `finally` block (always clean up, even on error)

```js
import pg from 'pg'

export async function execute(input, config) {
  const client = new pg.Client({ connectionString: config.connectionString })
  try {
    await client.connect()
    const result = await client.query(input.query)
    return { rows: result.rows, rowCount: result.rowCount }
  } finally {
    await client.end()
  }
}
```

### Phase 2: Read-only enforcement

**Goal:** Prevent the tool from executing destructive SQL (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, etc.).

Steps:

1. Before executing, wrap the query in a read-only transaction:
   ```sql
   BEGIN TRANSACTION READ ONLY;
   <user query>;
   COMMIT;
   ```
   PostgreSQL will reject any write operation inside a READ ONLY transaction with an error like `ERROR: cannot execute INSERT in a read-only transaction`.

2. As a defense-in-depth measure, also do a basic pre-check: trim and uppercase the query, verify it starts with `SELECT`, `WITH`, `EXPLAIN`, or `SHOW`. If it doesn't, reject immediately with a clear error message before even connecting. This catches obvious misuse cheaply.

```js
const ALLOWED_PREFIXES = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW']

function validateQuery(query) {
  const normalized = query.trim().toUpperCase()
  const startsWithAllowed = ALLOWED_PREFIXES.some(p => normalized.startsWith(p))
  if (!startsWithAllowed) {
    throw new Error('Only read-only queries are allowed (SELECT, WITH, EXPLAIN, SHOW)')
  }
}
```

### Phase 3: Safety limits

**Goal:** Prevent runaway queries from hanging the server or returning massive payloads.

Steps:

1. **Query timeout:** Set a `statement_timeout` on the connection (e.g., 30 seconds):
   ```js
   await client.query('SET statement_timeout = 30000')
   ```

2. **Row limit:** If the user didn't include a `LIMIT` clause, append `LIMIT 500` to cap result size. Check with a simple regex: if `/LIMIT\s+\d+/i` is not found in the query, append it.

3. **Connection timeout:** Pass `connectionTimeoutMillis: 10000` to the pg.Client constructor so it doesn't hang indefinitely trying to connect to unreachable hosts.

### Phase 4: Error handling

**Goal:** Return actionable error messages to Claude so it can self-correct.

Steps:

1. Catch `pg` errors and return structured error info rather than letting the raw error propagate:
   ```js
   catch (err) {
     throw new Error(`Database query failed: ${err.message}`)
   }
   ```

2. Common error scenarios to handle gracefully:
   - Connection refused (wrong host/port) → "Cannot connect to database at [host]"
   - Authentication failed → "Authentication failed — check connection string credentials"
   - Query syntax error → Pass through PostgreSQL's error message (it's already descriptive)
   - Timeout → "Query timed out after 30 seconds"

---

## Final Shape

```js
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
  const normalized = query.trim().toUpperCase()
  if (!ALLOWED_PREFIXES.some(p => normalized.startsWith(p))) {
    throw new Error('Only read-only queries are allowed (SELECT, WITH, EXPLAIN, SHOW)')
  }
}

function applyRowLimit(query) {
  if (!/LIMIT\s+\d+/i.test(query)) {
    return `${query.replace(/;\s*$/, '')} LIMIT ${DEFAULT_ROW_LIMIT}`
  }
  return query
}

export async function execute(input, config) {
  validateQuery(input.query)

  const query = applyRowLimit(input.query)
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
```

---

## Verification

1. **Unit test (manual):** Start a local PostgreSQL, configure the connection string, and test via the backend:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Show me all tables in the database",
       "config": { "apiKey": "sk-ant-...", "model": "claude-sonnet-4-20250514" },
       "connectors": {
         "database": { "type": "postgresql", "connectionString": "postgres://user:pass@localhost:5432/mydb" }
       }
     }'
   ```

2. **Safety test:** Attempt an INSERT — should be rejected at the validation layer and also by READ ONLY transaction if validation is bypassed.

3. **Timeout test:** Run `SELECT pg_sleep(60)` — should timeout after 30s.
