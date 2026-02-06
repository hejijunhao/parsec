# Changelog

- **0.1.0** — Initial project scaffolding with 3-tier architecture (frontend, backend, tool adapters)

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
