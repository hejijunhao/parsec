# 03 — Implement `fetch_logs` Tool

**File:** `backend/src/tools/logs.js`
**New dependencies:** None (uses Node.js built-in `fetch`)
**Parallel:** Yes — no dependency on other workstreams

---

## Current State

The file exports a `definition` (tool schema) and an `execute` function that throws `"Logs tool not yet implemented"`. The schema accepts three optional parameters: `timeframe` (e.g. `"1h"`, `"24h"`), `level` (error/warn/info/debug), and `search` (text filter).

The tool dispatcher passes `connectors.logs` as the config object, which has the shape:

```js
{ provider: 'vercel', apiKey: '...', projectId: '...' }
```

---

## Vercel API Reference

The Vercel Runtime Logs API is the relevant endpoint:

```
GET https://api.vercel.com/v3/runtime/logs
```

**Authentication:** Bearer token via `Authorization: Bearer <apiKey>` header.

**Key query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Required — the Vercel project ID |
| `startDate` | number | Unix timestamp (ms) — start of time range |
| `endDate` | number | Unix timestamp (ms) — end of time range |
| `source` | string | Filter: `"build"`, `"edge"`, `"lambda"`, `"static"` |

**Response:** JSON array of log entries, each with fields like:
```json
{
  "id": "...",
  "message": "log message text",
  "timestamp": 1700000000000,
  "source": "lambda",
  "level": "error",
  "requestId": "...",
  "statusCode": 500,
  "proxy": { "region": "iad1", ... }
}
```

> **Note:** If the exact API shape differs at implementation time, adjust accordingly. The Vercel API docs (https://vercel.com/docs/rest-api) are the source of truth. The implementation should be resilient to minor field name differences.

---

## Implementation Plan

### Phase 1: Timeframe parsing

**Goal:** Convert human-readable timeframes like `"1h"`, `"24h"`, `"7d"` into Unix timestamps.

Steps:

1. Create a helper function `parseTimeframe(timeframe)` that:
   a. Parses the format `<number><unit>` where unit is `m` (minutes), `h` (hours), `d` (days)
   b. Calculates `startDate` as `Date.now() - duration` in milliseconds
   c. Sets `endDate` as `Date.now()`
   d. Returns `{ startDate, endDate }` as Unix timestamps in ms
   e. Defaults to `"1h"` if no timeframe provided

```js
function parseTimeframe(timeframe = '1h') {
  const match = timeframe.match(/^(\d+)(m|h|d)$/)
  if (!match) throw new Error(`Invalid timeframe: "${timeframe}". Use format like "1h", "24h", "7d"`)

  const [, amount, unit] = match
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 }
  const durationMs = parseInt(amount) * multipliers[unit]
  const endDate = Date.now()
  return { startDate: endDate - durationMs, endDate }
}
```

### Phase 2: Vercel API integration

**Goal:** Fetch logs from the Vercel Runtime Logs API.

Steps:

1. Build the API URL with query parameters: `projectId`, `startDate`, `endDate`
2. Make a `fetch` GET request with the `Authorization: Bearer` header
3. Parse the JSON response
4. Handle HTTP error responses (401 unauthorized, 404 project not found, 429 rate limited)

```js
async function fetchVercelLogs(config, params) {
  const { startDate, endDate } = parseTimeframe(params.timeframe)

  const url = new URL('https://api.vercel.com/v3/runtime/logs')
  url.searchParams.set('projectId', config.projectId)
  url.searchParams.set('startDate', startDate.toString())
  url.searchParams.set('endDate', endDate.toString())

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vercel API error (${response.status}): ${body}`)
  }

  return response.json()
}
```

### Phase 3: Client-side filtering

**Goal:** Filter and format log entries by `level` and `search` text.

Steps:

1. After fetching logs from the API, apply local filters:
   a. If `input.level` is set, filter entries where `entry.level === input.level`
   b. If `input.search` is set, filter entries where `entry.message` contains the search text (case-insensitive)

2. Format the output for Claude — include the most useful fields:
   ```js
   const formatted = entries.map(entry => ({
     timestamp: new Date(entry.timestamp).toISOString(),
     level: entry.level || 'info',
     message: entry.message,
     source: entry.source,
     statusCode: entry.statusCode,
     requestId: entry.requestId,
   }))
   ```

3. Sort by timestamp descending (newest first).

### Phase 4: Provider routing

**Goal:** Structure the code so additional log providers can be added later.

Steps:

1. Create a provider dispatch map:
   ```js
   const providers = {
     vercel: fetchVercelLogs,
   }
   ```

2. In `execute()`, look up the provider from `config.provider` and call the corresponding function. If the provider isn't supported, throw a descriptive error listing supported providers.

3. This makes adding future providers (Supabase, Fly.io, AWS CloudWatch, etc.) a matter of adding a new function and entry in the map.

### Phase 5: Safety & limits

**Goal:** Prevent excessive API calls and massive responses.

Steps:

1. **Result limit:** Cap returned log entries at 200. If more are returned by the API, truncate and note it.

2. **Timeframe cap:** Reject timeframes longer than 30 days (`30d`) to avoid massive data pulls.

3. **Message truncation:** Truncate individual log messages longer than 2000 characters (some log entries can contain full stack traces or request bodies).

4. **Config validation:** Before making the API call, verify that `config.apiKey` and `config.projectId` are non-empty strings. Return a helpful error if not: `"Missing Vercel API key — configure it in the Connectors view"`.

---

## Final Shape

```js
const MAX_ENTRIES = 200
const MAX_MESSAGE_LENGTH = 2000
const MAX_TIMEFRAME_DAYS = 30

export const definition = {
  name: 'fetch_logs',
  description: 'Retrieve server logs from the connected logging provider',
  input_schema: {
    type: 'object',
    properties: {
      timeframe: { type: 'string', description: "Time range to fetch, e.g. '1h', '24h', '7d'" },
      level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
      search: { type: 'string', description: 'Filter logs containing this text' }
    }
  }
}

function parseTimeframe(timeframe = '1h') {
  const match = timeframe.match(/^(\d+)(m|h|d)$/)
  if (!match) throw new Error(`Invalid timeframe: "${timeframe}". Use format like "1h", "24h", "7d"`)

  const [, amount, unit] = match
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 }
  const durationMs = parseInt(amount) * multipliers[unit]

  if (unit === 'd' && parseInt(amount) > MAX_TIMEFRAME_DAYS) {
    throw new Error(`Timeframe too large. Maximum is ${MAX_TIMEFRAME_DAYS}d`)
  }

  const endDate = Date.now()
  return { startDate: endDate - durationMs, endDate }
}

function validateConfig(config) {
  if (!config.provider) throw new Error('No log provider configured — set it in the Connectors view')
  if (!config.apiKey) throw new Error(`Missing ${config.provider} API key — configure it in the Connectors view`)
  if (!config.projectId) throw new Error(`Missing ${config.provider} project ID — configure it in the Connectors view`)
}

async function fetchVercelLogs(config, params) {
  const { startDate, endDate } = parseTimeframe(params.timeframe)

  const url = new URL('https://api.vercel.com/v3/runtime/logs')
  url.searchParams.set('projectId', config.projectId)
  url.searchParams.set('startDate', startDate.toString())
  url.searchParams.set('endDate', endDate.toString())

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vercel API error (${response.status}): ${body}`)
  }

  return response.json()
}

const providers = {
  vercel: fetchVercelLogs,
}

export async function execute(input, config) {
  validateConfig(config)

  const fetcher = providers[config.provider]
  if (!fetcher) {
    throw new Error(`Unsupported log provider: "${config.provider}". Supported: ${Object.keys(providers).join(', ')}`)
  }

  let entries = await fetcher(config, input)

  // Normalize to array (API may return { logs: [...] } or [...])
  if (!Array.isArray(entries)) {
    entries = entries.logs || entries.data || []
  }

  // Filter by level
  if (input.level) {
    entries = entries.filter(e => e.level === input.level)
  }

  // Filter by search text
  if (input.search) {
    const searchLower = input.search.toLowerCase()
    entries = entries.filter(e =>
      (e.message || '').toLowerCase().includes(searchLower)
    )
  }

  // Sort newest first
  entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Truncate
  const totalCount = entries.length
  entries = entries.slice(0, MAX_ENTRIES)

  // Format for Claude
  const formatted = entries.map(e => ({
    timestamp: new Date(e.timestamp).toISOString(),
    level: e.level || 'info',
    message: (e.message || '').slice(0, MAX_MESSAGE_LENGTH),
    source: e.source,
    statusCode: e.statusCode,
    requestId: e.requestId,
  }))

  return {
    logs: formatted,
    count: formatted.length,
    total: totalCount,
    truncated: totalCount > MAX_ENTRIES,
    provider: config.provider,
  }
}
```

---

## Verification

1. **Auth test:** Use a valid Vercel API token and project ID. Ask Claude "Are there any errors in my Vercel logs from the last hour?" Should return log entries or an empty list.

2. **Bad auth test:** Use an invalid API key. Should return a clear 401 error message, not a crash.

3. **Missing config test:** Leave API key blank in Connectors. Should return `"Missing vercel API key — configure it in the Connectors view"` without making an API call.

4. **Filter test:** Ask for only error-level logs. Verify the response only contains entries with `level: "error"`.

5. **Timeframe test:** Request `"7d"` of logs. Verify the `startDate` parameter is 7 days ago.

---

## Future Providers

When adding a new provider (e.g., Supabase, Fly.io):

1. Create a new `async function fetchSupabaseLogs(config, params)` following the same pattern
2. Add `supabase: fetchSupabaseLogs` to the `providers` map
3. Add `<option value="supabase">Supabase</option>` to `ConnectorsView.vue`
4. The rest of the pipeline (filtering, formatting, limits) is shared automatically
