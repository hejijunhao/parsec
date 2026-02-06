# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Parsec is a framework that connects AI agents (Claude) to databases, codebases, and server logs. It's a stateless MVP web app — no database backend, no sessions, credentials are passed per-request from the frontend.

## Development Commands

### Backend (Express, port 3000)
```bash
cd backend && npm install
npm run dev          # dev mode with --watch
npm start            # production mode
```

### Frontend (Vue 3 + Vite, port 5173)
```bash
cd frontend && npm install
npm run dev          # vite dev server
npm run build        # production build
npm run preview      # preview production build
```

Run both simultaneously for development. The Vite dev server proxies `/api` requests to `localhost:3000`.

No test framework or linter is configured yet.

## Architecture

**Stateless request-per-call design:** The frontend accumulates conversation history in Pinia state and replays the full message array with each API call. Backend stores nothing between requests.

### Request Flow
```
AgentView → store.sendMessage(text)
  → POST /api/chat { messages, config: {apiKey, model, systemPrompt}, connectors }
  → Claude SDK call with tool definitions
  → Agentic loop (max 10 iterations):
      Claude requests tool → execute tool → feed results back → repeat
  → Return { content, toolCalls } → display in AgentView
```

### Backend (`backend/src/`)
- **`index.js`** — Express setup, CORS, mounts routes at `/api`
- **`routes/chat.js`** — Single POST `/api/chat` endpoint implementing the agentic tool loop
- **`claude/client.js`** — Anthropic SDK wrapper, creates client from per-request API key
- **`tools/index.js`** — Tool dispatcher; maps tool names to implementations
- **`tools/database.js`** — `query_database`: read-only SQL via `pg` with prefix validation, READ ONLY transactions, 30s timeout, auto LIMIT 500
- **`tools/codebase.js`** — `search_codebase`: glob pattern + content search via `fast-glob`, with path traversal protection and binary filtering
- **`tools/logs.js`** — `fetch_logs`: Vercel log retrieval with timeframe/level/search filtering

### Frontend (`frontend/src/`)
- **`stores/appStore.js`** — Pinia store holding connectors config, agent config, messages array, and `sendMessage()` which calls the backend
- **Views:** `ConnectorsView` (data source config), `AgentConfigView` (Claude API key/model/prompt), `AgentView` (chat UI with collapsible tool call details)
- **Routes:** `/` redirects to `/connectors`, then `/config`, then `/agent`

### Key Design Decisions
- ES modules throughout (`"type": "module"` in both package.json files)
- Tool safety: database enforces read-only at both validation and transaction level; codebase blocks path traversal; all tools cap output size
- No persistent storage — all state lives in the Vue frontend (lost on refresh)
