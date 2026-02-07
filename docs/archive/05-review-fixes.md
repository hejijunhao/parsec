# 05 — Post-Review Fixes — Completion Notes

**Plan:** `docs/executing/05-review-fixes.md`
**Status:** Implemented
**Date:** 2026-02-06

---

## What was modified

Six files changed across backend and frontend. No new dependencies added.

---

### P0 — SQL Injection via Statement Stacking

**File:** `backend/src/tools/database.js`

**Why:** `SELECT 1; COMMIT; DROP TABLE users` bypassed read-only enforcement — the prefix check passed (`SELECT`), then PostgreSQL's simple query protocol executed all three statements, with `COMMIT` closing the `READ ONLY` transaction before `DROP TABLE` ran unprotected.

**What changed:**

- `validateQuery()` now strips a single trailing semicolon, then rejects any remaining semicolons in the query body (`'Multiple statements are not allowed'`)
- `validateQuery()` returns the trimmed query string (no trailing semicolon)
- `applyRowLimit()` no longer strips semicolons itself — it receives the already-clean string from `validateQuery()`
- `execute()` chains the two: `validateQuery() → applyRowLimit()` with the validated string passed through

---

### P1 — Timeframe Cap Bypass

**File:** `backend/src/tools/logs.js`

**Why:** The 30-day maximum only checked `unit === 'd'`, so `744h` (31 days) and `44640m` (31 days) bypassed it.

**What changed:**

- Replaced unit-specific check with computed `durationMs` validation against `MAX_TIMEFRAME_DAYS * 86_400_000`
- Added zero-duration guard (`durationMs <= 0`) to reject `0h`, `0m`, `0d`

---

### P1 — Missing Request Body Validation

**File:** `backend/src/routes/chat.js`

**Why:** Missing `config`, `config.apiKey`, `config.model`, `messages`, or `connectors` produced opaque downstream errors from the Claude SDK or tool dispatcher. No early validation existed.

**What changed:**

- Added four guards at the top of the route handler, before any SDK or tool calls:
  - `!config?.apiKey` → 400 with "Missing Claude API key" pointing to Agent Config
  - `!config.model` → 400 with "Missing model selection" pointing to Agent Config
  - `!message && !incomingMessages?.length` → 400 with "No message provided"
  - `!connectors || typeof connectors !== 'object'` → 400 with "Missing connector configuration" pointing to Connectors

---

### P2 — `toISOString()` Crash on Malformed Log Entries

**File:** `backend/src/tools/logs.js`

**Why:** `new Date(undefined).toISOString()` throws `RangeError`. A single malformed entry from the Vercel API crashed the entire request.

**What changed:**

- Wrapped timestamp conversion in a `try/catch` inside the `.map()` formatter
- On failure, `timestamp` is set to `null` instead of crashing

---

### P2 — No CSS / Broken Auto-Scroll / Unbounded Tool Results

**File:** `frontend/src/views/AgentView.vue`

**Why:** No `<style>` block existed. The `.messages` container had no `overflow-y` or height constraint, so it grew infinitely and the `scrollTop = scrollHeight` auto-scroll was a no-op. Large tool result JSON also blew out the DOM.

**What changed:**

- Added scoped `<style>` block with:
  - `.agent-view` as a flex column with `max-height: 100vh`
  - `.messages` with `flex: 1` and `overflow-y: auto` (fixes auto-scroll)
  - Role-based background colours: user (`#f0f0f0`), assistant (`#e8f4fd`), error (`#fde8e8`)
  - `.tool-input` / `.tool-result` capped at `max-height: 200px` with `overflow-y: auto` (caps unbounded tool output rendering)
  - Form layout with flex + gap

---

### P2 — MySQL Option With No Backend Support

**File:** `frontend/src/views/ConnectorsView.vue`

**Why:** The MySQL dropdown option was selectable but the backend only supports `pg.Client`. Selecting it produced a confusing PostgreSQL connection error.

**What changed:**

- Added `disabled` attribute and changed label to `MySQL (coming soon)` — signals intent without misleading

---

### P3 — No Codebase Path Existence Check

**File:** `backend/src/tools/codebase.js`

**Why:** If the configured path didn't exist, `fast-glob` silently returned an empty array. Claude couldn't distinguish "path doesn't exist" from "no files matched."

**What changed:**

- Added `access` import from `fs/promises`
- Added `fs.access()` check at the top of `execute()` — throws a descriptive error if the path doesn't exist or isn't accessible

---

### P3 — Tool Context Lost Between Turns (MVP Interim)

**File:** `frontend/src/views/AgentView.vue`

**Why:** Conversation history strips `tool_use`/`tool_result` blocks between turns, so Claude loses tool data on follow-ups. Full fix deferred to a post-MVP workstream.

**What changed:**

- Added a `.context-tip` paragraph above the input form: "Tip: include full context in each message — the agent does not recall tool data from earlier turns."
- Styled with muted text (`0.8em`, `#888`)

---

## Summary of files changed

| File | Fixes applied |
|------|--------------|
| `backend/src/tools/database.js` | P0 semicolon injection |
| `backend/src/tools/logs.js` | P1 timeframe bypass + zero guard, P2 timestamp crash |
| `backend/src/routes/chat.js` | P1 request body validation |
| `backend/src/tools/codebase.js` | P3 path existence check |
| `frontend/src/views/AgentView.vue` | P2 CSS/scroll/result capping, P3 context tip |
| `frontend/src/views/ConnectorsView.vue` | P2 MySQL option disabled |
