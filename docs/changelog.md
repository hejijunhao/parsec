# Changelog

- **0.1.7** — Multi-provider model selection with researched current models
- **0.1.6** — Connectors UI refinement (button selectors, multi-provider logs)
- **0.1.5** — Post-review security and robustness fixes (P0–P3)
- **0.1.4** — Wire up chat UI with agentic tool-use loop (frontend + backend)
- **0.1.3** — Implement `fetch_logs` tool with Vercel provider
- **0.1.2** — Implement `search_codebase` tool with file and content search
- **0.1.1** — Implement `query_database` tool with read-only PostgreSQL queries
- **0.1.0** — Initial project scaffolding with 3-tier architecture (frontend, backend, tool adapters)

---

## 0.1.7 — Multi-Provider Model Selection

Redesigned the Agent Config view with a two-tier provider/model selection system.

### Provider Selection
- Added tab-based provider selector: Anthropic, OpenAI, Google, Mistral
- API key placeholder updates dynamically per provider
- Switching provider auto-selects a sensible default model

### Model Cards
- Replaced dropdown with visual model cards in a responsive grid
- Each card shows: model name, description, and optional tag (latest/recommended/preview)
- Color-coded tags: green for latest, white for recommended, amber for preview

### Current Models (researched Feb 2026)

**Anthropic:** Opus 4.6, Sonnet 4.5, Haiku 4.5, Opus 4.5, Sonnet 4
**OpenAI:** GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-4o, GPT-4o Mini
**Google:** Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 3 Pro/Flash (preview)
**Mistral:** Mistral Large, Magistral Medium, Mistral Medium, Mistral Small

### Backend
- Added provider validation in chat.js — returns helpful error for unimplemented providers
- Only Anthropic is implemented for MVP; others return a clear "coming soon" message

### Branding
- Added three-dot parsec logo to header (favicon design)
- Configured Vite `@` alias for cleaner asset imports

---

## 0.1.6 — Connectors UI Refinement

Redesigned the Connectors view with improved UX patterns for source selection.

### Database Section
- Replaced dropdown with button-based selection (PostgreSQL active, MySQL "coming soon")
- Config fields appear only after selecting a database type

### Codebase Section
- Added three source options as button selectors:
  - **GitHub URL** — for public repositories (active)
  - **GitHub Token** — for private repos (coming soon)
  - **Trajan** — autonomous PM tool integration (coming soon)
- Updated store structure from `{ path }` to `{ source, url }`

### Server Logs Section
- Redesigned as a multi-provider grid of expandable cards
- Users can enable/configure multiple providers simultaneously
- Added providers: Vercel, Fly.io, Grafana, AWS CloudWatch, Azure Monitor, Google Cloud, Redis, Datadog, Supabase
- Each provider shows a green checkmark and border when configured
- Updated store structure to support per-provider configuration

### Backend Compatibility
- Added `resolveLogsConfig()` in tools/index.js — translates multi-provider config to single-provider format for the tool
- Added `resolveCodebaseConfig()` — translates new codebase config structure
- Updated validation in logs.js and codebase.js to handle null configs gracefully

---

## 0.1.5 — Post-Review Fixes

Security and robustness fixes from code review of workstreams 01–04.

### P0 — SQL Injection (`database.js`)
- `validateQuery()` now strips trailing semicolon, then rejects queries containing internal semicolons (blocks statement stacking attacks like `SELECT 1; COMMIT; DROP TABLE`)
- `applyRowLimit()` receives the already-clean string, no longer strips semicolons itself

### P1 — Timeframe Cap Bypass (`logs.js`)
- Validates computed `durationMs` against the 30-day max instead of checking only the `d` unit — blocks `744h`, `44640m` etc.
- Rejects zero-duration timeframes (`0h`, `0m`, `0d`)

### P1 — Request Body Validation (`chat.js`)
- Added early 400 responses for missing `apiKey`, `model`, `messages`, and `connectors` with actionable error messages

### P2 — Timestamp Crash Guard (`logs.js`)
- Wrapped `new Date(e.timestamp).toISOString()` in try/catch — malformed entries return `null` timestamp instead of crashing

### P2 — CSS + Auto-Scroll (`AgentView.vue`)
- Added scoped `<style>` block with flex layout, `overflow-y: auto` on `.messages` (fixes auto-scroll), role-based backgrounds, and `max-height: 200px` on tool result containers

### P2 — MySQL Option (`ConnectorsView.vue`)
- Disabled MySQL dropdown option with "coming soon" label

### P3 — Codebase Path Check (`codebase.js`)
- Added `fs.access()` check at top of `execute()` — descriptive error if path doesn't exist

### P3 — Tool Context Note (`AgentView.vue`)
- Added tip above input: "include full context in each message — the agent does not recall tool data from earlier turns"

---

## 0.1.4 — Chat UI Wiring

Connected the frontend chat interface to the backend agentic loop, completing the end-to-end flow.

### Backend (`routes/chat.js`)
- Agentic tool-use loop: executes tools Claude requests, feeds results back, repeats until Claude produces a final text response (max 10 iterations)
- Per-tool error handling so individual failures don't crash the request
- Accepts full `messages` array for multi-turn conversation

### Store (`appStore.js`)
- Added `sendMessage()` async action with loading/error state management
- Sends full conversation history to backend, attaches tool call metadata to assistant messages

### UI (`AgentView.vue`)
- Input disabled during loading with "Sending..." indicator
- Messages differentiated by role (user, assistant, error)
- Collapsible tool call details on assistant messages (name, input, result)
- Auto-scroll to latest message

---

## 0.1.3 — `fetch_logs` Tool

Replaced the `logs.js` stub with a Vercel runtime logs integration.

- Timeframe parsing (`1h`, `24h`, `7d` etc.) with 30-day maximum
- Config validation with user-facing error messages pointing to the Connectors view
- Vercel API integration (`GET /v3/runtime/logs`) with Bearer auth
- Post-fetch pipeline: normalises response shape, filters by level/search, sorts newest-first, caps at 200 entries, truncates long messages
- Provider dispatch map for easy future expansion
- No new dependencies — uses Node.js built-in `fetch`

---

## 0.1.2 — `search_codebase` Tool

Replaced the `codebase.js` stub with file pattern and content search using `fast-glob`.

- **File mode:** glob patterns against a configured base path, capped at 100 results
- **Content mode:** case-insensitive substring search across matched files, returning line numbers and context (max 50 files, 20 lines per file)
- Path traversal protection, binary file skipping, and default ignores (`node_modules/`, `.git/`, `dist/`, `build/`)
- Added `fast-glob` dependency

---

## 0.1.1 — `query_database` Tool

Replaced the `database.js` stub with a full PostgreSQL query execution tool.

- Read-only enforcement via two layers: SQL prefix validation (`SELECT`, `WITH`, `EXPLAIN`, `SHOW` only) and PostgreSQL `READ ONLY` transactions
- 30s query timeout, 10s connection timeout, and automatic `LIMIT 500` on unbounded queries
- Errors caught and re-thrown with descriptive messages for Claude self-correction
- Connection cleanup guaranteed via `finally` block

---

## 0.1.0 — Initial Scaffolding

Project scaffolding based on the MVP architecture document, structured around a consistent 3-tier / 3-section architecture.

### Frontend (Vue 3 + Vite)
- Set up Vue 3 project with Vite, Vue Router, and Pinia
- Created 3 views matching the architecture sections:
  - **ConnectorsView** — forms for database, codebase, and server log connection config
  - **AgentConfigView** — Claude API key, model selection, optional system prompt
  - **AgentView** — chat interface with message list and input
- Added Pinia store (`appStore.js`) with reactive state for connectors, agent config, and messages
- Configured Vite proxy to forward `/api` requests to the backend

### Backend (Node.js + Express)
- Set up Express server with CORS and JSON parsing
- Organised into 3 sections:
  - **Routes** (`src/routes/`) — `POST /api/chat` endpoint wired to Claude SDK
  - **Claude** (`src/claude/`) — SDK client wrapper (`createClaudeClient`)
  - **Tools** (`src/tools/`) — tool registry with definition + executor pattern
- Stubbed 3 tool adapters matching the external source tiers:
  - `database.js` — `query_database` (PostgreSQL via pg, read-only)
  - `codebase.js` — `search_codebase` (file/content pattern matching)
  - `logs.js` — `fetch_logs` (provider API integration, Vercel first)
- Tool index exports shared `toolDefinitions` array and `executeTool` dispatcher

### Project Root
- Added `.gitignore` (node_modules, dist, .env)
