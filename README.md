<p align="center">
  <img src="frontend/src/assets/logo.svg" alt="Parsec Logo" width="120" />
</p>

<h1 align="center">Parsec</h1>

<p align="center">
  <strong>Connect AI agents to your databases, codebases, and server logs</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#providers">Providers</a> •
  <a href="#tools">Tools</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/version-0.1.9-green.svg" alt="Version" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node" />
</p>

---

## What is Parsec?

Parsec is an open-source framework that gives AI agents secure, read-only access to your infrastructure. Ask questions in natural language, and let the agent query your database, search your codebase, or analyze your logs.

```
You: "What were the most common errors in the last 24 hours?"

Agent: I'll check the server logs for you.
       [fetch_logs: timeframe="24h", level="error"]

       Found 47 errors in the last 24 hours. The top 3:
       1. Connection timeout (23 occurrences) — mostly from /api/users
       2. Rate limit exceeded (15 occurrences) — from IP 203.0.113.42
       3. Invalid JSON payload (9 occurrences) — POST /api/webhooks
```

---

## Features

🔌 **Multi-Provider Support** — Use Claude, GPT-4, Gemini, or Mistral with a unified interface

🗄️ **Database Queries** — Read-only SQL access with automatic safety limits

📁 **Codebase Search** — Glob patterns and content search across your repositories

📊 **Log Analysis** — Query Vercel logs with time ranges and filters (more providers coming)

🔒 **Security First** — Read-only enforcement, path traversal protection, output size caps

🎨 **Modern UI** — Dark mode Vue 3 interface with real-time tool call visibility

---

## Quick Start

### Prerequisites

- Node.js 18+
- An API key from at least one LLM provider

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/parsec.git
cd parsec

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Running

Open two terminal windows:

```bash
# Terminal 1: Backend (port 3000)
cd backend && npm run dev

# Terminal 2: Frontend (port 5173)
cd frontend && npm run dev
```

Visit **http://localhost:5173** and follow the setup wizard:

1. **Connectors** — Configure your data sources (database, codebase, logs)
2. **Agent Config** — Enter your API key and select a model
3. **Agent** — Start chatting with your infrastructure

---

## Architecture

Parsec uses a **stateless request-per-call design**. The frontend maintains conversation history and replays it with each API call — no backend database required.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue 3)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Connectors  │  │Agent Config │  │      Agent Chat         │  │
│  │   View      │──│    View     │──│        View             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                              │                                   │
│                    Pinia Store (messages, config)                │
└──────────────────────────────┼───────────────────────────────────┘
                               │ POST /api/chat
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Agentic Loop                         │    │
│  │    ┌──────────┐    ┌──────────┐    ┌──────────┐        │    │
│  │    │ Provider │───▶│   Tool   │───▶│ Provider │ ─(repeat)   │
│  │    │  .chat() │    │ Executor │    │  .chat() │        │    │
│  │    └──────────┘    └──────────┘    └──────────┘        │    │
│  └─────────────────────────────────────────────────────────┘    │
│            │                                                     │
│  ┌─────────┴─────────────────────────────────────────────┐      │
│  │                   Provider Adapters                    │      │
│  │  Anthropic  │  OpenAI  │  Google Gemini  │  Mistral   │      │
│  └────────────────────────────────────────────────────────┘      │
│            │                                                     │
│  ┌─────────┴─────────────────────────────────────────────┐      │
│  │                      Tools                             │      │
│  │  query_database  │  search_codebase  │  fetch_logs    │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Postgres │    │ Codebase │    │  Vercel  │
        │    DB    │    │  (Glob)  │    │   Logs   │
        └──────────┘    └──────────┘    └──────────┘
```

---

## Providers

Parsec supports multiple LLM providers through a unified adapter interface:

| Provider | Models | Status |
|----------|--------|--------|
| **Anthropic** | Claude Opus 4.5/4.6, Sonnet 4/4.5, Haiku 4.5 | ✅ Supported |
| **OpenAI** | GPT-4.1, GPT-4.1 Mini/Nano, GPT-4o | ✅ Supported |
| **Google** | Gemini 2.5 Pro/Flash, Gemini 3 (preview) | ✅ Supported |
| **Mistral** | Large, Magistral Medium, Medium, Small | ✅ Supported |

Each provider implements the same interface, so switching models is just a dropdown change.

---

## Tools

### `query_database`

Execute read-only SQL queries against PostgreSQL.

```json
{
  "query": "SELECT name, email FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
}
```

**Safety features:**
- Prefix validation (only `SELECT`, `WITH`, `EXPLAIN`, `SHOW`)
- `READ ONLY` transaction mode
- 30-second timeout
- Automatic `LIMIT 500` on unbounded queries

### `search_codebase`

Search files by pattern or content.

```json
{
  "pattern": "**/*.ts",
  "search": "async function",
  "mode": "content"
}
```

**Safety features:**
- Path traversal protection
- Binary file filtering
- Default ignores (`node_modules/`, `.git/`, `dist/`)
- 100 file / 50 content match limits

### `fetch_logs`

Retrieve and filter server logs.

```json
{
  "timeframe": "24h",
  "level": "error",
  "search": "timeout"
}
```

**Supported providers:**
- ✅ Vercel
- 🔜 Fly.io, AWS CloudWatch, Grafana, Datadog, and more

---

## Configuration

### Environment Variables

Parsec is stateless — all configuration passes per-request from the frontend. No `.env` file is required for basic operation.

For production deployments, you may want to set:

```bash
PORT=3000              # Backend port (default: 3000)
NODE_ENV=production    # Enable production optimizations
```

### Connector Configuration

Configure data sources in the **Connectors** view:

| Source | Required Fields |
|--------|-----------------|
| Database | Host, Port, Database, User, Password |
| Codebase | GitHub URL (public repos) |
| Logs | Provider + API Token |

---

## Security

Parsec is designed with security as a core principle:

- **Read-only database access** — Enforced at both SQL validation and PostgreSQL transaction levels
- **Path traversal protection** — Codebase searches are sandboxed to configured directories
- **Output size limits** — All tools cap response sizes to prevent memory issues
- **No credential storage** — API keys pass per-request; nothing persists on the backend
- **Input validation** — Request bodies are validated before processing

⚠️ **Note:** This is an MVP. For production use, consider adding:
- Rate limiting
- Request authentication
- Audit logging
- Network-level restrictions

---

## Project Structure

```
parsec/
├── backend/
│   └── src/
│       ├── index.js           # Express server setup
│       ├── routes/
│       │   └── chat.js        # Agentic loop endpoint
│       ├── providers/         # LLM provider adapters
│       │   ├── index.js       # Provider factory
│       │   ├── anthropic.js
│       │   ├── openai.js
│       │   ├── google.js
│       │   └── mistral.js
│       └── tools/             # Tool implementations
│           ├── index.js       # Tool dispatcher
│           ├── database.js
│           ├── codebase.js
│           └── logs.js
├── frontend/
│   └── src/
│       ├── App.vue
│       ├── stores/
│       │   └── appStore.js    # Pinia state management
│       └── views/
│           ├── ConnectorsView.vue
│           ├── AgentConfigView.vue
│           └── AgentView.vue
└── docs/
    ├── vision.md
    ├── changelog.md
    └── mvp-architecture.md
```

---

## Development

### Commands

```bash
# Backend
cd backend
npm run dev          # Development with hot reload
npm start            # Production mode

# Frontend
cd frontend
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
```

### Adding a New Provider

1. Create `backend/src/providers/<name>.js` implementing the adapter interface
2. Register in `backend/src/providers/index.js`
3. Add model options in `frontend/src/views/AgentConfigView.vue`

See `backend/src/providers/types.js` for the interface definition.

### Adding a New Tool

1. Create `backend/src/tools/<name>.js` with `definition` and `execute` exports
2. Register in `backend/src/tools/index.js`
3. Tools are automatically available to all providers

---

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Areas We'd Love Help With

- 🔌 New log providers (Fly.io, AWS CloudWatch, Datadog)
- 🗄️ Additional database support (MySQL, SQLite)
- 🧪 Test coverage
- 📚 Documentation improvements
- 🎨 UI/UX enhancements

---

## Roadmap

- [ ] MySQL and SQLite database support
- [ ] Additional log providers (Fly.io, AWS, Datadog, Grafana)
- [ ] GitHub integration for private repositories
- [ ] Streaming responses
- [ ] Conversation persistence (optional)
- [ ] MCP (Model Context Protocol) server mode

---

## License

Parsec is open-source software licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/your-org">Crimson Sun</a>
</p>
