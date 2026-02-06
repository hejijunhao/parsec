# 05 — Post-Review Fixes

**Source:** Code review of workstreams 01–04
**Status:** Not started

---

## P0 — SQL Injection via Statement Stacking

**File:** `backend/src/tools/database.js`

**Problem:** The read-only enforcement can be bypassed. A query like `SELECT 1 LIMIT 1; COMMIT; DROP TABLE users` passes prefix validation (starts with `SELECT`), passes `applyRowLimit` unchanged (already has `LIMIT \d+`), then PostgreSQL's simple query protocol processes all three statements sequentially — the `COMMIT` closes the READ ONLY transaction, and the `DROP TABLE` executes unprotected in auto-commit mode.

**Fix:** Reject queries containing semicolons after stripping a single trailing one. Add this to `validateQuery()`:

```js
function validateQuery(query) {
  const trimmed = query.trim().replace(/;\s*$/, '')  // strip trailing semicolon
  const normalized = trimmed.toUpperCase()

  if (!ALLOWED_PREFIXES.some(p => normalized.startsWith(p))) {
    throw new Error('Only read-only queries are allowed (SELECT, WITH, EXPLAIN, SHOW)')
  }

  if (trimmed.includes(';')) {
    throw new Error('Multiple statements are not allowed')
  }
}
```

Also update `applyRowLimit` to operate on the already-stripped query so the semicolon logic is consistent — pass the trimmed string through rather than re-stripping inside `applyRowLimit`.

---

## P1 — Timeframe Cap Bypass

**File:** `backend/src/tools/logs.js`

**Problem:** The 30-day maximum is only enforced when the unit is `d`. `744h` (31 days) and `44640m` (31 days) both bypass the check.

**Fix:** Validate the computed `durationMs` instead of checking unit and amount separately. Replace lines 26–28:

```js
const maxDurationMs = MAX_TIMEFRAME_DAYS * 86_400_000
if (durationMs > maxDurationMs) {
  throw new Error(`Timeframe too large. Maximum is ${MAX_TIMEFRAME_DAYS}d`)
}
```

Also reject zero-duration timeframes (`0h`, `0m`, `0d`) which produce an empty range:

```js
if (durationMs <= 0) {
  throw new Error('Timeframe must be greater than zero')
}
```

---

## P1 — Missing Request Body Validation

**File:** `backend/src/routes/chat.js`

**Problem:** If `config`, `config.apiKey`, `config.model`, or `connectors` is missing/undefined, the route produces opaque errors from downstream code (Claude SDK, tool dispatcher). No early validation exists.

**Fix:** Add guards at the top of the route handler, before any SDK or tool calls:

```js
chatRouter.post('/chat', async (req, res) => {
  const { message, messages: incomingMessages, config, connectors } = req.body

  if (!config?.apiKey) {
    return res.status(400).json({ error: 'Missing Claude API key — configure it in Agent Config' })
  }
  if (!config.model) {
    return res.status(400).json({ error: 'Missing model selection — configure it in Agent Config' })
  }
  if (!message && !incomingMessages?.length) {
    return res.status(400).json({ error: 'No message provided' })
  }
  if (!connectors || typeof connectors !== 'object') {
    return res.status(400).json({ error: 'Missing connector configuration — set up at least one source in Connectors' })
  }

  // ... rest of handler
})
```

---

## P2 — `toISOString()` Crash on Malformed Log Entries

**File:** `backend/src/tools/logs.js`

**Problem:** In the formatting step, `new Date(e.timestamp).toISOString()` throws a `RangeError` if `e.timestamp` is `undefined` (produces `Invalid Date`). A single malformed entry from the Vercel API crashes the entire request.

**Fix:** Guard the timestamp conversion in the `.map()` formatter:

```js
const formatted = entries.map(e => {
  let timestamp
  try {
    timestamp = new Date(e.timestamp).toISOString()
  } catch {
    timestamp = null
  }

  return {
    timestamp,
    level: e.level || 'info',
    message: (e.message || '').slice(0, MAX_MESSAGE_LENGTH),
    source: e.source,
    statusCode: e.statusCode,
    requestId: e.requestId,
  }
})
```

---

## P2 — No CSS / Broken Auto-Scroll

**File:** `frontend/src/views/AgentView.vue`

**Problem:** No `<style>` block exists. The `.messages` container has no `overflow-y` or height constraint, so it grows infinitely and the `scrollTop = scrollHeight` auto-scroll logic is a no-op. The chat is also visually unstyled.

**Fix:** Add a scoped `<style>` block with functional layout CSS. The goal is a fixed-height scrollable message area with basic visual differentiation between roles — not a design polish pass.

```vue
<style scoped>
.agent-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  padding: 1rem;
}

.messages {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.message {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.message.user {
  background: #f0f0f0;
}

.message.assistant {
  background: #e8f4fd;
}

.message.error {
  background: #fde8e8;
  color: #b91c1c;
}

.tool-calls {
  margin-top: 0.5rem;
  font-size: 0.85em;
}

.tool-input,
.tool-result {
  max-height: 200px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 2px;
  font-size: 0.85em;
}

form {
  display: flex;
  gap: 0.5rem;
}

form input {
  flex: 1;
}

.loading em {
  color: #888;
}
</style>
```

The `max-height: 200px` on `.tool-input` / `.tool-result` also addresses the **P3 unbounded tool result rendering** issue — large JSON payloads scroll within a capped container instead of blowing out the DOM.

---

## P2 — MySQL Option With No Backend Support

**File:** `frontend/src/views/ConnectorsView.vue`

**Problem:** The database type dropdown includes a MySQL option, but the backend exclusively uses `pg.Client`. Selecting MySQL produces a confusing PostgreSQL connection error.

**Fix:** Remove the MySQL option and add a comment for future support:

```html
<select v-model="store.connectors.database.type">
  <option value="">Select...</option>
  <option value="postgresql">PostgreSQL</option>
  <!-- MySQL: add option here once backend/src/tools/database.js supports it -->
</select>
```

Alternatively, keep it but disable it:

```html
<option value="mysql" disabled>MySQL (coming soon)</option>
```

The second approach is better UX — it signals intent without misleading.

---

## P3 — Tool Context Lost Between Turns

**File:** `frontend/src/stores/appStore.js`

**Problem:** `sendMessage()` builds conversation history as `{ role, content }` text only. Claude's `tool_use` blocks and the corresponding `tool_result` blocks from prior turns are stripped. On turn 2+, Claude has no memory of the actual tool data — only its own text summary. Multi-turn tool-dependent conversations will be unreliable (e.g., user asks a follow-up about data Claude queried).

**Fix:** Preserve the full message structure for assistant messages. The backend already returns assistant content as text, but we can change the store to track the raw message shape the backend expects and replay it:

In `appStore.js`, change history construction to include tool call context:

```js
const history = messages.value
  .filter(m => m.role === 'user' || m.role === 'assistant')
  .map(m => ({ role: m.role, content: m.content }))
```

This is a larger change because it requires the backend to return the full `response.content` (including `tool_use` blocks) alongside the final text, and the store to track and replay the interleaved `assistant` / `user(tool_result)` message pairs. Scope this as a separate workstream post-MVP rather than patching it in here.

**MVP interim:** No code change. Document the limitation in the UI — e.g., a small note in the AgentView: "Tip: include full context in each message — the agent does not recall tool data from earlier turns."

---

## P3 — No Codebase Path Existence Check

**File:** `backend/src/tools/codebase.js`

**Problem:** If the configured path doesn't exist, `fast-glob` returns an empty array silently. Claude gets `{ files: [], count: 0 }` with no way to distinguish "path doesn't exist" from "no files matched the pattern."

**Fix:** Add an `fs.access` check at the top of `execute()`:

```js
import { readFile, access } from 'fs/promises'

export async function execute(input, config) {
  const basePath = resolve(config.path)

  try {
    await access(basePath)
  } catch {
    throw new Error(`Codebase path does not exist or is not accessible: ${config.path}`)
  }

  // ... rest of function
}
```

---

## Execution Order

No blocking dependencies between fixes. Suggested order by priority:

```
P0  SQL injection semicolon fix          database.js       (do first)
P1  Timeframe cap + zero guard           logs.js
P1  Request body validation              chat.js
P2  Timestamp crash guard                logs.js           (combine with timeframe fix)
P2  CSS + auto-scroll + result capping   AgentView.vue
P2  MySQL option disable                 ConnectorsView.vue
P3  Codebase path existence check        codebase.js
P3  Tool context limitation note         AgentView.vue     (combine with CSS pass)
```

P0 should be done before any real usage. Everything else can be parallelized.
