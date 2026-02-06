# Parsec MVP Architecture

## Overview

Parsec is a stateless web application that connects AI agents to databases, codebases, and server logs. Users configure connections and interact with an agent that can query these sources in real-time.

## Tech Stack

| Layer    | Technology       |
|----------|------------------|
| Frontend | Vue 3 + Vite     |
| Backend  | Node.js (Express or Fastify) |
| Agent    | Claude SDK (tool-calling) |

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Vue Frontend                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Connectors  │  │ Agent Config │  │      Agent        │  │
│  │   View      │  │    View      │  │   (Chat View)     │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      Node.js Backend                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  /api/chat  │  │ Tool Router  │  │  Claude SDK       │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Tool Execution
┌─────────────────────────────────────────────────────────────┐
│                      External Sources                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Databases  │  │  Codebases   │  │   Server Logs     │  │
│  │  (SQL, etc) │  │  (Git repos) │  │ (Vercel, AWS...)  │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Views

### 1. Connectors View
User inputs connection details for each source type:

- **Database**: Connection string, type (PostgreSQL, MySQL, etc.)
- **Codebase**: Local path or Git repo URL
- **Server Logs**: Provider selection, API key, project ID

All credentials stored in Vue reactive state (memory only, not persisted).

### 2. Agent Config View
- Claude API key input
- Model selection (claude-sonnet-4-20250514, claude-opus-4-20250514, etc.)
- Optional: system prompt customization

### 3. Agent View (Chat)
- Chat interface for user ↔ agent interaction
- Displays tool usage (which sources the agent queried)
- Streams responses in real-time

## Backend API

### Endpoints

| Method | Endpoint     | Description                        |
|--------|--------------|------------------------------------|
| POST   | `/api/chat`  | Send message, receive streamed response |

### Request Payload
```json
{
  "message": "What errors occurred in the last hour?",
  "config": {
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-20250514"
  },
  "connectors": {
    "database": {
      "type": "postgresql",
      "connectionString": "postgres://..."
    },
    "logs": {
      "provider": "vercel",
      "apiKey": "...",
      "projectId": "..."
    },
    "codebase": {
      "path": "/path/to/repo"
    }
  }
}
```

## Claude Tools

The backend registers these tools with the Claude SDK:

### `query_database`
```javascript
{
  name: "query_database",
  description: "Execute a read-only SQL query against the connected database",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "SQL SELECT query" }
    },
    required: ["query"]
  }
}
```

### `search_codebase`
```javascript
{
  name: "search_codebase",
  description: "Search for files or code patterns in the connected codebase",
  input_schema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Search pattern (glob or regex)" },
      content_search: { type: "string", description: "Search within file contents" }
    }
  }
}
```

### `fetch_logs`
```javascript
{
  name: "fetch_logs",
  description: "Retrieve server logs from the connected logging provider",
  input_schema: {
    type: "object",
    properties: {
      timeframe: { type: "string", description: "e.g., '1h', '24h', '7d'" },
      level: { type: "string", enum: ["error", "warn", "info", "debug"] },
      search: { type: "string", description: "Filter logs containing this text" }
    }
  }
}
```

## Stateless Design

- **No database** on the Parsec side
- **No sessions** - credentials passed with each request
- **No persistence** - user re-enters config each visit
- Future: optional config export/import as JSON blob

## Directory Structure (Proposed)

```
parsec/
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── ConnectorsView.vue
│   │   │   ├── AgentConfigView.vue
│   │   │   └── AgentView.vue
│   │   ├── components/
│   │   ├── stores/
│   │   │   └── appStore.js       # Pinia store for state
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.js              # Express/Fastify entry
│   │   ├── routes/
│   │   │   └── chat.js
│   │   ├── tools/
│   │   │   ├── database.js
│   │   │   ├── codebase.js
│   │   │   └── logs.js
│   │   └── claude/
│   │       └── client.js         # Claude SDK wrapper
│   └── package.json
├── docs/
│   ├── vision.md
│   └── mvp-architecture.md
└── LICENSE
```

## MVP Scope

**In scope:**
- Single database connection (PostgreSQL first)
- Single codebase (local path)
- Single log provider (Vercel first)
- Basic chat UI with streaming
- Tool execution visibility

**Out of scope (post-MVP):**
- Multiple simultaneous connections
- Saved configurations / user accounts
- Conversation history persistence
- Additional log providers
- File editing capabilities
