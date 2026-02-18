# Parsec Architecture Reference

A detailed reference of Parsec's structure, patterns, and implementation decisions — intended as a foundation for building Heimdall.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Request Lifecycle](#2-request-lifecycle)
3. [Backend](#3-backend)
   - [Entry Point & Middleware](#31-entry-point--middleware)
   - [The Agentic Loop](#32-the-agentic-loop)
   - [Provider Abstraction](#33-provider-abstraction)
   - [Tool System](#34-tool-system)
   - [Logging](#35-logging)
4. [Frontend](#4-frontend)
   - [App Shell & Routing](#41-app-shell--routing)
   - [State Management](#42-state-management)
   - [Views](#43-views)
5. [Data Structures](#5-data-structures)
   - [API Contract](#51-api-contract)
   - [Provider Adapter Interface](#52-provider-adapter-interface)
   - [Tool Definition Schema](#53-tool-definition-schema)
   - [Connector Config Shapes](#54-connector-config-shapes)
6. [Security Model](#6-security-model)
7. [Design Decisions & Trade-offs](#7-design-decisions--trade-offs)
8. [Extension Points](#8-extension-points)

---

## 1. High-Level Architecture

Parsec is a stateless web application with two tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Vue 3 + Vite, port 5173)                           │
│                                                                 │
│  ConnectorsView ─→ AgentConfigView ─→ AgentView (chat)         │
│       │                  │                  │                   │
│       └──────── Pinia Store (appStore) ─────┘                   │
│                        │                                        │
│                  POST /api/chat                                  │
│                  { messages, config, connectors }                │
└────────────────────────┬────────────────────────────────────────┘
                         │  Vite proxy in dev
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND  (Express, port 3000)                                  │
│                                                                 │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────────────┐  │
│  │ Routes  │───→│ Agentic Loop │───→│ Provider Adapters      │  │
│  │ chat.js │    │ (max 10 iter)│    │ anthropic/openai/      │  │
│  └─────────┘    └──────┬───────┘    │ google/mistral         │  │
│                        │            └────────────────────────┘  │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │  Tool Executors │                               │
│               │  database.js    │──→ PostgreSQL                  │
│               │  codebase.js    │──→ GitHub / Local FS           │
│               │  logs.js        │──→ Vercel API                  │
│               └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

**Core principle:** The backend is entirely stateless. The frontend holds all conversation history and configuration in a Pinia store and replays the full message array with every API call. The backend stores nothing between requests — no sessions, no database, no persistent state. The only exception is an in-memory clone cache for GitHub repos that lives in process memory and is lost on restart.

---

## 2. Request Lifecycle

Every user message follows this path:

```
1. User types message in AgentView
2. store.sendMessage(text) fires
3. User message appended to local messages[]
4. POST /api/chat with:
   ├── messages: full conversation history (role + content only)
   ├── config: { provider, apiKey, model, systemPrompt }
   └── connectors: { database, codebase, logs }
5. Backend validates request fields
6. createProvider(config) → provider adapter instance
7. provider.translateTools(toolDefinitions) → provider-format tools
8. AGENTIC LOOP (up to 10 iterations):
   │
   ├── provider.chat(messages, tools, systemPrompt)
   ├── provider.requiresToolExecution(response)?
   │   ├── NO  → break, extract final text
   │   └── YES → continue
   ├── provider.extractToolCalls(response) → [{ id, name, input }]
   ├── For each tool call:
   │   └── executeTool(name, input, connectors) → result or error
   ├── provider.formatToolResults(results)
   └── provider.appendToConversation(messages, response, results)
   │
9. provider.extractText(response) → final content string
10. Return { content, toolCalls[] } to frontend
11. Assistant message with tool metadata appended to store
12. AgentView renders message + collapsible tool details
```

The agentic loop is the heart of Parsec. The model decides which tools to call, the backend executes them, feeds the results back, and the model decides again — up to 10 times — until it produces a final text response.

---

## 3. Backend

### 3.1 Entry Point & Middleware

**File:** `backend/src/index.js`

Express app with three layers:
- **CORS** — open cross-origin (for dev proxy and future deployment)
- **JSON body parsing** — `express.json()`
- **Request timing middleware** — logs every request/response with method, path, status code, and duration via the logger

Routes mounted at `/api`, so the single endpoint is `POST /api/chat`.

### 3.2 The Agentic Loop

**File:** `backend/src/routes/chat.js`

This is the core engine. A single POST endpoint that:

1. **Validates** the request body — requires `config.apiKey`, `config.model`, `messages` (or `message`), and `connectors`. Returns 400 with actionable error messages if anything is missing.

2. **Creates a provider** via the factory function. If the provider isn't implemented, returns a 400 with the list of supported providers.

3. **Translates tools** — converts the canonical tool definitions into the provider's expected format.

4. **Runs the loop** — calls the LLM, checks if it wants to use tools, executes them, appends results, and repeats. Each tool call is independently try/caught so one failure doesn't kill the whole request.

5. **Collects metadata** — every tool call (name, input, result or error) is tracked and returned alongside the final text response. This powers the collapsible tool details in the chat UI.

6. **Returns** `{ content: string, toolCalls: Array }`.

The loop has a hard cap of 10 iterations. If the model keeps requesting tools beyond that, the loop exits with whatever text the last response contained.

### 3.3 Provider Abstraction

**Files:** `backend/src/providers/`

A factory + adapter pattern that makes the agentic loop provider-agnostic.

#### The Interface

Every provider adapter implements 7 methods:

| Method | Purpose |
|---|---|
| `chat(messages, tools, systemPrompt)` | Send messages to the LLM and get a response |
| `translateTools(toolDefinitions)` | Convert canonical tool defs to provider format |
| `extractToolCalls(response)` | Pull tool call objects from the response |
| `extractText(response)` | Pull the final text content from the response |
| `requiresToolExecution(response)` | Check if the model wants to call tools |
| `formatToolResults(toolResults)` | Convert tool results to provider format |
| `appendToConversation(messages, response, toolResults)` | Build the next messages array for the loop |

#### The Factory

`createProvider(config)` looks up the provider name in a registry and returns the instantiated adapter. The registry is a plain object mapping names to factory functions.

#### Provider-Specific Details

**Anthropic** (`anthropic.js`)
- Canonical format — tool definitions pass through untranslated
- System prompt is a top-level API parameter (not a message)
- Stop reason: `'tool_use'`
- Tool calls are content blocks with `type: 'tool_use'`
- Tool results are content blocks with `type: 'tool_result'` in a user message
- Uses `@anthropic-ai/sdk`

**OpenAI** (`openai.js`)
- Tools wrapped in `{ type: 'function', function: { name, description, parameters } }`
- System prompt injected as a `{ role: 'system' }` message
- Stop reason: `'tool_calls'`
- Tool calls on `message.tool_calls`, arguments are JSON strings that need parsing
- Each tool result is a separate `{ role: 'tool' }` message
- Uses `openai` SDK

**Google Gemini** (`google.js`)
- Most divergent adapter — Gemini uses a stateful chat model
- Must reconstruct the full chat session from history on each request (since backend is stateless)
- Role mapping: `'assistant'` → `'model'`
- Message format: `{ role, parts: [{ text }] }` with `functionCall`/`functionResponse` parts
- System prompt via `systemInstruction` in model config
- Tool IDs are synthetic (`gemini-${Date.now()}-${idx}`) since Gemini doesn't assign them
- Uses `@google/generative-ai`

**Mistral** (`mistral.js`)
- Nearly identical to OpenAI but with camelCase property names (`toolCalls`, `toolChoice`, `finishReason`, `toolCallId`)
- SDK method is `client.chat.complete()` (not `chat.completions.create()`)
- Uses `@mistralai/mistralai`

### 3.4 Tool System

**Files:** `backend/src/tools/`

#### Registry & Dispatcher (`tools/index.js`)

Three components:
1. **`toolDefinitions`** — exported array of canonical tool schemas (name, description, input_schema). This is what gets passed to providers.
2. **`executeTool(name, input, connectors)`** — dispatcher that resolves config and calls the right executor.
3. **Config resolution functions** — translate the frontend's connector config into the shape each tool expects:
   - `resolveCodebaseConfig(codebase)` — handles `{ source: 'github-url', url }` → `{ source, url }`
   - `resolveLogsConfig(logs)` — finds the first enabled log provider and returns `{ provider, ...config }`

#### `query_database` (`tools/database.js`)

Executes read-only SQL against PostgreSQL.

**Config:** `{ connectionString }` — a standard Postgres connection URI.

**Safety layers:**
1. **SQL prefix whitelist** — only `SELECT`, `WITH`, `EXPLAIN`, `SHOW` are allowed
2. **Statement stacking prevention** — strips trailing semicolon, then rejects any remaining semicolons (blocks `SELECT 1; DROP TABLE`)
3. **Auto LIMIT** — appends `LIMIT 500` if no LIMIT clause is present
4. **Read-only transaction** — wraps every query in `BEGIN TRANSACTION READ ONLY` / `COMMIT`
5. **Timeouts** — 10s connection timeout, 30s query timeout (set via `SET statement_timeout`)

**Returns:** `{ rows: Array, rowCount: number }`

Uses the `pg` library. Connection is created per-call and cleaned up in a `finally` block.

#### `search_codebase` (`tools/codebase.js`)

Searches files by glob pattern and/or content substring.

**Config:** Either `{ source: 'github-url', url }` or `{ path }` (local filesystem).

**Two modes:**
1. **File search** (pattern only) — globs against the base path, returns up to 100 file paths
2. **Content search** (pattern + content_search) — globs to find files, then reads each and does case-insensitive substring matching, returning matching lines with line numbers (max 50 files, 20 lines per file)

**GitHub clone management:**
- `normalizeGitHubUrl(url)` — strips `www.`, `.git`, trailing `/` for consistent cache keys
- `ensureCloned(url)` — shallow clones to `/tmp/parsec-repo-<hash>/`, with:
  - In-memory `Map` cache to avoid re-cloning within a process
  - On-disk `.git` check to reuse clones across restarts
  - `git pull --ff-only` to freshen existing clones
  - 60s clone timeout, 30s pull timeout

**Safety:** Path traversal protection (`fullPath.startsWith(basePath)` check), binary file filtering, default ignores (`node_modules/`, `.git/`, `dist/`, `build/`).

Uses `fast-glob` for pattern matching and `fs/promises` for file reading.

#### `fetch_logs` (`tools/logs.js`)

Retrieves server logs from external providers.

**Config:** `{ provider, apiKey, projectId, ... }` — varies by provider.

**Currently implemented:** Vercel only (`GET /v3/runtime/logs` with Bearer auth).

**Processing pipeline:**
1. Parse timeframe string (`'1h'`, `'7d'`, etc.) into start/end dates
2. Validate against 30-day maximum (checks computed duration, not just unit)
3. Fetch from provider API
4. Normalize response shape (handle `{ logs: [] }` or `{ data: [] }`)
5. Filter by level and/or search text (case-insensitive)
6. Sort newest-first
7. Truncate to 200 entries, messages to 2000 chars

**Returns:** `{ logs: Array, count, total, truncated, provider }`

Provider dispatch is a simple object map, making it easy to add new providers.

### 3.5 Logging

**File:** `backend/src/logger.js`

A lightweight logging utility with ANSI color-coded prefixes and timestamps:

| Prefix | Color | Usage |
|---|---|---|
| `[REQ]` | Cyan | Incoming requests |
| `[RES]` | Green | Outgoing responses |
| `[TOOL]` | Magenta | Tool executions |
| `[LOOP]` | Yellow | Agentic loop iterations |
| `[ERR]` | Red | Errors |

Timestamps use `HH:MM:SS` format. The logger is used in the request middleware (index.js) and throughout the agentic loop (chat.js) to trace the full lifecycle of each request.

---

## 4. Frontend

### 4.1 App Shell & Routing

**Files:** `main.js`, `App.vue`

The Vue 3 app bootstraps with Pinia and Vue Router using HTML5 history mode.

**Routes:**
| Path | View | Purpose |
|---|---|---|
| `/` | — | Redirects to `/connectors` |
| `/connectors` | ConnectorsView | Configure data source connections |
| `/config` | AgentConfigView | Select LLM provider, model, API key |
| `/agent` | AgentView | Chat with the agent |

The app shell (`App.vue`) provides a fixed topbar with the Parsec logo and three navigation links. Active route is highlighted with an accent color and bottom border. The content area below fills the remaining viewport height.

### 4.2 State Management

**File:** `stores/appStore.js`

A single Pinia store (`useAppStore`) holds all application state. Three logical sections:

**1. Connectors** — configuration for each data source type:
- `database`: `{ type, connectionString }`
- `codebase`: `{ source, url }` where source is `'github-url'`, `'github-token'`, or `'trajan'`
- `logs`: an object with a key per provider (vercel, flyio, grafana, aws, azure, gcp, redis, datadog, supabase), each containing `{ enabled, ...providerSpecificFields }`

**2. Agent Config** — LLM settings:
- `provider`: one of `'anthropic'`, `'openai'`, `'google'`, `'mistral'`
- `apiKey`: sent per-request, never persisted
- `model`: provider-specific model ID
- `systemPrompt`: optional custom instructions

**3. Chat State:**
- `messages`: array of `{ role, content, toolCalls? }`
- `loading`: boolean
- `error`: string or null

**Key action — `sendMessage(text)`:**
1. Adds user message to local history
2. Strips `toolCalls` metadata from prior messages (backend only needs role + content)
3. POSTs to `/api/chat` with `{ messages, config: agentConfig, connectors }`
4. Appends the assistant's response (with tool call metadata) to local history
5. Manages loading/error state

### 4.3 Views

#### ConnectorsView

Three-section form for configuring data sources:

- **Database** — button selector (PostgreSQL active, MySQL coming soon), connection string input
- **Codebase** — button selector (GitHub URL active, GitHub Token and Trajan coming soon), repo URL input
- **Server Logs** — responsive grid of expandable provider cards. Each card has a header (name + enabled checkmark), expandable config fields, and enable/disable buttons. Only one card expands at a time. 9 providers displayed (only Vercel functional).

#### AgentConfigView

Two-tier selection system:

- **Provider tabs** — four buttons across the top. Switching provider auto-selects a sensible default model.
- **API key** — password input with provider-specific placeholder text. Info note that keys are per-request and never stored.
- **Model cards** — responsive grid filtered by current provider. Each card shows model name, description, and optional tag (latest/recommended/preview) with color coding.
- **System prompt** — optional textarea.

Models are defined as a static array in the component, with current entries researched as of Feb 2026.

#### AgentView

The chat interface:

- **Message list** — scrollable container that auto-scrolls on new messages. Three message types:
  - *User* — right-aligned, elevated background, labelled "YOU"
  - *Assistant* — left-aligned with accent border, labelled "AGENT". If tool calls are present, a collapsible `<details>` element shows "N tool(s) used" with pretty-printed JSON for each tool's input and result.
  - *Error* — red-bordered, labelled "ERROR"
- **Loading indicator** — animated 3-dot pulse animation
- **Context tip** — reminds users that "the agent does not recall tool data from earlier turns"
- **Input bar** — text input + SEND button, disabled during loading

---

## 5. Data Structures

### 5.1 API Contract

**`POST /api/chat`**

Request body:
```json
{
  "messages": [
    { "role": "user", "content": "Show me all error logs from the last hour" },
    { "role": "assistant", "content": "I'll fetch those logs for you." }
  ],
  "config": {
    "provider": "anthropic",
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-5-20250929",
    "systemPrompt": "You are a helpful DevOps assistant."
  },
  "connectors": {
    "database": { "type": "postgresql", "connectionString": "postgres://..." },
    "codebase": { "source": "github-url", "url": "https://github.com/owner/repo" },
    "logs": {
      "vercel": { "enabled": true, "apiKey": "...", "projectId": "prj_..." },
      "flyio": { "enabled": false, "apiKey": "", "appName": "" }
    }
  }
}
```

Response body:
```json
{
  "content": "Here are the error logs from the past hour...",
  "toolCalls": [
    {
      "tool": "fetch_logs",
      "input": { "timeframe": "1h", "level": "error" },
      "result": { "logs": [...], "count": 12, "total": 12, "truncated": false, "provider": "vercel" }
    }
  ]
}
```

Error responses: `400` for validation/provider errors, `500` for unexpected failures. Both return `{ error: string }`.

### 5.2 Provider Adapter Interface

```javascript
{
  // Send messages to LLM, get raw provider response
  chat(messages: Message[], tools: any[], systemPrompt: string): Promise<any>

  // Convert canonical tool definitions to provider format
  translateTools(toolDefinitions: ToolDefinition[]): any[]

  // Extract structured tool calls from provider response
  extractToolCalls(response: any): ToolCall[]
  // → [{ id: string, name: string, input: object }]

  // Extract final text from provider response
  extractText(response: any): string

  // Check if model is requesting tool execution
  requiresToolExecution(response: any): boolean

  // Convert tool results to provider message format
  formatToolResults(toolResults: ToolResult[]): any[]

  // Build updated messages array with response + tool results
  appendToConversation(messages: Message[], response: any, toolResults: any[]): Message[]
}
```

The canonical internal format for tool calls and results:
```javascript
// ToolCall (extracted from LLM response)
{ id: string, name: string, input: object }

// ToolResult (after execution, before formatting)
{ toolCallId: string, name: string, content: string }
```

### 5.3 Tool Definition Schema

Tools are defined in Anthropic's canonical format (JSON Schema for input):

```javascript
{
  name: "query_database",
  description: "Execute a read-only SQL query against the connected database",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The SQL query to execute" }
    },
    required: ["query"]
  }
}
```

Each provider adapter translates this into its own format via `translateTools()`.

### 5.4 Connector Config Shapes

After resolution (what tools actually receive):

```javascript
// Database
{ connectionString: "postgres://user:pass@host:5432/db" }

// Codebase (GitHub)
{ source: "github-url", url: "https://github.com/owner/repo" }

// Logs (resolved from multi-provider config)
{ provider: "vercel", apiKey: "...", projectId: "prj_..." }
```

---

## 6. Security Model

Parsec takes a defence-in-depth approach despite being an MVP:

**Credential handling:**
- API keys are sent per-request from the frontend and never persisted on the backend
- No sessions, no cookies, no server-side storage of secrets
- Frontend holds keys in reactive state only (lost on page refresh)

**Database tool:**
- SQL prefix whitelist (SELECT/WITH/EXPLAIN/SHOW only)
- Statement stacking prevention (semicolon rejection after stripping trailing)
- Automatic LIMIT 500 on unbounded queries
- PostgreSQL READ ONLY transaction enforcement (double-layered with validation)
- 10s connection timeout, 30s query timeout
- Per-call connection lifecycle (no connection pooling that could leak)

**Codebase tool:**
- Path traversal protection — resolved paths must start with the base path
- Binary file filtering by extension
- Default ignores for `node_modules/`, `.git/`, `dist/`, `build/`
- File and line count caps to prevent memory exhaustion
- GitHub clones are shallow (`--depth 1`) and isolated to `/tmp/`

**Logs tool:**
- Timeframe validation against 30-day max (checks computed duration, not just unit)
- Zero-duration rejection
- Config validation with provider-specific required fields
- Entry count cap (200) and message truncation (2000 chars)

**General:**
- Request body validation with actionable 400 error messages
- Per-tool try/catch in the agentic loop (one tool failure doesn't crash the request)
- 10-iteration hard cap on the agentic loop
- Tool output size caps across all tools

---

## 7. Design Decisions & Trade-offs

### Statelessness
**Decision:** Backend stores nothing. Frontend replays full history.
**Why:** Simplest possible architecture for an MVP. No database, no sessions, no auth — just a request/response cycle. Means the backend can be horizontally scaled trivially.
**Trade-off:** Conversation history is lost on page refresh. Every request includes the full message array, which grows with conversation length. Token costs scale with conversation size.

### Provider as Canonical Format
**Decision:** Anthropic's tool format is the canonical internal representation.
**Why:** Parsec started as an Anthropic-only tool. Making Anthropic canonical means the Anthropic adapter is a passthrough, and other adapters translate to/from a known format.
**Trade-off:** Other providers need more translation code. If a provider has capabilities that don't map to the canonical format, they're harder to expose.

### Config Resolution Layer
**Decision:** `resolveCodebaseConfig()` and `resolveLogsConfig()` sit between the raw connector config and tool execution.
**Why:** The frontend's config shape (optimised for UI — button selectors, multi-provider grids) doesn't match what tools need. Resolution functions bridge this gap without coupling tools to UI concerns.
**Trade-off:** Extra indirection. Adding a new connector source means updating both the resolution function and the tool.

### In-Memory Clone Cache
**Decision:** GitHub repo clones are cached in a `Map` in process memory.
**Why:** Avoids re-cloning on every tool call within a conversation. Fast and simple.
**Trade-off:** Cache is lost on process restart. Not shared across multiple backend instances. No eviction policy — clones accumulate in `/tmp/` until the OS cleans them or the process restarts.

### Tool Safety Over Flexibility
**Decision:** All tools enforce strict limits (read-only SQL, path traversal blocks, output caps).
**Why:** Users are connecting Parsec to real infrastructure. A bug or prompt injection that drops a table or reads `/etc/passwd` would be catastrophic.
**Trade-off:** No write operations on databases. No ability to run arbitrary commands. Users who want write access need to modify the tool code.

### Single API Endpoint
**Decision:** One endpoint (`POST /api/chat`) handles everything.
**Why:** The backend's only job is to run the agentic loop. There's no state to CRUD, no auth to manage, no resources to list.
**Trade-off:** Doesn't scale well if Heimdall needs separate endpoints for conversation management, tool configuration, streaming, etc.

---

## 8. Extension Points

These are the seams in the architecture where Heimdall will likely diverge:

### Adding a New LLM Provider
1. Create `backend/src/providers/<name>.js` implementing all 7 adapter methods
2. Register in `backend/src/providers/index.js`
3. Add model entries in `frontend/src/views/AgentConfigView.vue`

### Adding a New Tool
1. Create `backend/src/tools/<name>.js` with a definition and execute function
2. Register in `backend/src/tools/index.js` (add to `toolDefinitions` array and `executors` map)
3. Add a config resolution function if the connector config needs translation
4. Add connector UI in `frontend/src/views/ConnectorsView.vue`

### Adding a New Log Provider
1. Add a fetch function in `backend/src/tools/logs.js`
2. Register in the `providers` dispatch map
3. Add validation rules for the new provider's required config fields
4. Frontend support already exists — the provider card grid supports arbitrary providers

### Moving to Persistent State
The most significant architectural change for Heimdall. Currently:
- Conversation history → frontend Pinia store
- Connector config → frontend Pinia store
- API keys → frontend Pinia store
- Clone cache → backend process memory

To add persistence, you'd introduce:
- A database for conversations, configs, and user accounts
- Server-side sessions or JWT auth
- Encrypted credential storage (not per-request plaintext)
- A proper clone management service with eviction

### Adding Streaming
Currently the agentic loop runs to completion and returns a single JSON response. For streaming:
- Switch to Server-Sent Events or WebSocket for the chat endpoint
- Stream text chunks as they arrive from the LLM
- Send tool call events as they start/complete
- Handle the loop iterations as a series of events rather than a blocking call

### Adding Write Operations
The database tool is intentionally read-only. To support writes:
- Add explicit opt-in per connector (user confirms write access)
- Implement approval workflows (show the SQL, wait for user confirmation)
- Add audit logging for all write operations
- Consider sandboxed transaction previews (run in a transaction, show results, rollback unless confirmed)
