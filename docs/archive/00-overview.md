# Execution Overview — MVP Implementation

## Goal

Turn the Parsec scaffolding into a working product by implementing the 4 remaining pieces:

| # | Workstream | File(s) | Plan |
|---|-----------|---------|------|
| 1 | `query_database` tool | `backend/src/tools/database.js` | [01-query-database.md](./01-query-database.md) |
| 2 | `search_codebase` tool | `backend/src/tools/codebase.js` | [02-search-codebase.md](./02-search-codebase.md) |
| 3 | `fetch_logs` tool | `backend/src/tools/logs.js` | [03-fetch-logs.md](./03-fetch-logs.md) |
| 4 | Chat UI wire-up | `frontend/src/views/AgentView.vue`, `backend/src/routes/chat.js`, `frontend/src/stores/appStore.js` | [04-chat-ui-wiring.md](./04-chat-ui-wiring.md) |

## Parallelism

**All 4 workstreams can be executed in parallel.** There are no blocking dependencies between them:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  01 Database     │  │  02 Codebase     │  │  03 Logs         │  │  04 Chat UI      │
│  tool impl       │  │  tool impl       │  │  tool impl       │  │  wire-up         │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │                     │
         └─────────────────────┴─────────────────────┴─────────────────────┘
                                         │
                                    Integration
                                     testing
```

**Why they're independent:**

- The three tools (01–03) each implement a single `execute(input, config)` function with no shared code between them.
- The tool dispatcher (`backend/src/tools/index.js`) already routes calls by name — it doesn't care about the internals of each tool.
- The chat UI wire-up (04) works against the `/api/chat` endpoint and the tool dispatcher interface, not against individual tool implementations. It can be developed and tested with any single tool working (or even with the stubs throwing errors — the error path is also valid to test).

## Integration Test

After all 4 workstreams are complete, do a full end-to-end test:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Go to `/connectors` — configure at least one source (easiest: codebase with a local path)
4. Go to `/config` — enter Claude API key, select model
5. Go to `/agent` — ask "What files are in this project?" (tests codebase tool)
6. Verify: message sent, tool called, tool results shown, Claude response displayed

## New Dependencies

| Package | Workstream | Purpose |
|---------|-----------|---------|
| `fast-glob` | 02 (codebase) | File pattern matching |

Install: `cd backend && npm install fast-glob`
