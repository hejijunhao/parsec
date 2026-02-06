# 01 — `query_database` Tool — Completion Notes

**Status:** Complete
**File modified:** `backend/src/tools/database.js`
**Plan:** `docs/executing/01-query-database.md`

---

## What Changed

Replaced the stub `execute()` function (which threw `"Database tool not yet implemented"`) with a full implementation covering all 4 phases from the plan.

### Phase 1: Core query execution
- Added `import pg from 'pg'` (already a dependency in `backend/package.json`)
- `execute(input, config)` creates a `pg.Client` from `config.connectionString`, connects, runs the query, returns `{ rows, rowCount }`, and disconnects in a `finally` block

### Phase 2: Read-only enforcement
- **Defense-in-depth layer 1 — prefix validation:** `validateQuery()` trims and uppercases the query, then checks it starts with one of `SELECT`, `WITH`, `EXPLAIN`, or `SHOW`. Rejects anything else before a connection is even attempted.
- **Defense-in-depth layer 2 — read-only transaction:** The query is wrapped in `BEGIN TRANSACTION READ ONLY` / `COMMIT`. PostgreSQL itself will reject any write operation even if it somehow passes the prefix check.

### Phase 3: Safety limits
- **Query timeout:** `SET statement_timeout = 30000` (30s) applied immediately after connecting — prevents runaway queries
- **Row limit:** `applyRowLimit()` checks for an existing `LIMIT \d+` clause; if absent, strips any trailing semicolon and appends `LIMIT 500`
- **Connection timeout:** `connectionTimeoutMillis: 10000` (10s) passed to the `pg.Client` constructor — prevents hanging on unreachable hosts

### Phase 4: Error handling
- All `pg` errors caught and re-thrown as `Error(`Database query failed: ${err.message}`)` — gives Claude actionable context to self-correct (connection refused, auth failure, syntax error, timeout, etc.)
- `client.end()` in the `finally` block has a `.catch(() => {})` to suppress disconnect errors and ensure cleanup never throws

## Files Not Modified

- `backend/src/tools/index.js` — already had the correct mapping (`query_database` → `executeDatabase`), no changes needed
- `backend/package.json` — `pg` was already listed as a dependency, no additions needed
- Tool `definition` object (schema) — kept as-is from the scaffolding, matches the plan

## How to Verify

1. Start a local PostgreSQL instance
2. `cd backend && npm install && npm run dev`
3. Test via curl or the chat UI:
   - Valid read: `SELECT * FROM some_table` — should return rows
   - Write attempt: `INSERT INTO ...` — rejected by prefix validation
   - Slow query: `SELECT pg_sleep(60)` — times out after 30s
   - Bad connection string — fails with descriptive connection error
