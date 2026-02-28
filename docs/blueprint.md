# Parsec — Framework Blueprint

> **Audience for this document:** An LLM building the Parsec public-facing webpage. This blueprint covers what Parsec is, what makes it different, how it works, and what it can do — everything needed to communicate its value clearly.

---

## 1. What Parsec Is

Parsec is an open-source framework that connects AI agents to operational infrastructure — databases, codebases, and server logs. It gives any LLM (Claude, GPT, Gemini, Mistral) the ability to autonomously query your PostgreSQL database, search your GitHub repositories, and retrieve your server logs — all through natural language.

**In one sentence:** Parsec turns any LLM into an infrastructure-aware agent that can investigate, query, and explore your systems on your behalf.

---

## 2. Core USPs — What Sets Parsec Apart

### 2.1 Universal LLM Compatibility

Parsec is not locked to a single AI provider. It supports **four major LLM providers** through a unified adapter interface:

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Opus 4.6, Sonnet 4.5, Haiku 4.5, Opus 4.5, Sonnet 4 |
| **OpenAI** | GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-4o, GPT-4o Mini |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 3 Pro/Flash (preview) |
| **Mistral** | Mistral Large, Magistral Medium, Mistral Medium, Mistral Small |

Users pick their provider and model — Parsec handles the rest. The same tools, same agentic loop, same experience, regardless of which LLM is behind it. No vendor lock-in.

### 2.2 Three Infrastructure Connectors

Parsec connects to the three data sources that matter most for understanding and debugging production systems:

1. **Database** — Read-only SQL queries against PostgreSQL. Ask "show me users who signed up this week" or "what are the top 10 most expensive orders" and the agent writes and executes the SQL.

2. **Codebase** — File and content search across GitHub repositories. Ask "find all API route handlers" or "where is the authentication middleware defined" and the agent searches your code with glob patterns and substring matching.

3. **Server Logs** — Log retrieval from cloud providers (Vercel, with Fly.io, AWS CloudWatch, Grafana, Datadog, and more on the roadmap). Ask "show me errors from the last hour" or "find logs mentioning timeout" and the agent fetches and filters them.

These three connectors cover the core loop of production investigation: *read the data, read the code, read the logs*.

### 2.3 Agentic Tool-Use Loop

Parsec doesn't just make a single API call — it runs an **autonomous agentic loop**. When you ask a question, the agent can:

1. Decide which tools to call (and in what order)
2. Execute those tools against your infrastructure
3. Read the results
4. Decide if it needs more information
5. Call more tools if needed
6. Repeat up to 10 iterations
7. Synthesize a final answer

This means the agent can chain operations: query the database to find an anomaly, search the codebase for the relevant handler, then pull logs from that timeframe — all from a single natural-language question.

### 2.4 Security-First Tool Design

Every connector is built with defense-in-depth safety:

- **Database:** Three layers of read-only enforcement — SQL prefix allowlist (SELECT/WITH/EXPLAIN/SHOW only), semicolon injection blocking, and PostgreSQL `READ ONLY` transactions at the database level. 30-second query timeout. Auto-applied row limit of 500.
- **Codebase:** Path traversal protection, binary file filtering, output size caps, default directory exclusions (node_modules, .git, dist, build).
- **Logs:** 30-day maximum timeframe, 200-entry cap, 2000-character message truncation.

The agent can explore freely, but it cannot modify, delete, or corrupt anything.

### 2.5 Zero Backend State — Credentials Never Stored

Parsec is **fully stateless on the server**. There are no sessions, no database backend, no persistent storage of any kind. API keys and connection strings are passed per-request from the browser and never written to disk or held in memory between requests.

This means:
- No credential storage to secure or breach
- No server-side data to leak
- Self-hostable with zero infrastructure beyond a Node.js process
- Every request is independent and self-contained

### 2.6 Open Source (Apache 2.0)

Parsec is Apache-2.0 licensed. Fully open, commercially permissive, no strings attached.

---

## 3. How It Works — Architecture Overview

### 3.1 High-Level Flow

```
User (browser)
  │
  ▼
┌──────────────────────────────────┐
│  Vue 3 Frontend (port 5173)      │
│  ┌────────────┐                  │
│  │ Pinia Store │ ◄── all state   │
│  │  messages[] │     lives here  │
│  │  config     │                 │
│  │  connectors │                 │
│  └─────┬──────┘                  │
│        │ POST /api/chat          │
│        │ { messages, config,     │
│        │   connectors }          │
└────────┼─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Express Backend (port 3000)     │
│                                  │
│  ┌──────────────────────┐        │
│  │  Provider Factory     │        │
│  │  createProvider(cfg)  │        │
│  │  → Anthropic adapter  │        │
│  │  → OpenAI adapter     │        │
│  │  → Google adapter     │        │
│  │  → Mistral adapter    │        │
│  └──────────┬───────────┘        │
│             │                    │
│  ┌──────────▼───────────┐        │
│  │  Agentic Loop         │        │
│  │  (max 10 iterations)  │        │
│  │                       │        │
│  │  1. LLM generates     │        │
│  │  2. Tool calls?       │        │
│  │     → execute tools   │        │
│  │     → feed results    │        │
│  │     → loop back to 1  │        │
│  │  3. Final text answer │        │
│  └──────────┬───────────┘        │
│             │                    │
│  ┌──────────▼───────────┐        │
│  │  Tool Adapters        │        │
│  │  ┌─────────────────┐  │        │
│  │  │ query_database   │  │        │
│  │  │ search_codebase  │  │        │
│  │  │ fetch_logs       │  │        │
│  │  └─────────────────┘  │        │
│  └──────────────────────┘        │
└──────────────────────────────────┘
         │              │
         ▼              ▼
    PostgreSQL     GitHub / Vercel
    (your DB)      (your repos/logs)
```

### 3.2 The Three Screens

The frontend has three views that form a setup-then-use flow:

1. **Connectors** (`/connectors`) — Configure your data sources. Paste a PostgreSQL connection string, enter a GitHub repo URL, enable and configure log providers. Button-based selectors with expandable configuration cards.

2. **Agent Config** (`/config`) — Choose your LLM provider (tab selector), enter your API key, pick a model (visual model cards with tags like "latest", "recommended", "preview"), and optionally set a system prompt.

3. **Agent** (`/agent`) — The chat interface. Send messages, see the agent's responses, and inspect tool calls via collapsible detail panels that show both the tool input and result.

### 3.3 Provider Adapter Interface

Every LLM provider implements the same 7-method interface, making the agentic loop completely provider-agnostic:

| Method | Purpose |
|--------|---------|
| `chat()` | Send messages + tools to the LLM, get a response |
| `translateTools()` | Convert canonical tool definitions to provider-specific format |
| `extractToolCalls()` | Pull tool call requests out of the provider's response |
| `extractText()` | Pull the final text content out of the provider's response |
| `requiresToolExecution()` | Check if the response contains tool calls that need executing |
| `formatToolResults()` | Format tool execution results for the provider's expected shape |
| `appendToConversation()` | Add the assistant response and tool results to the message history |

The Anthropic format is the canonical internal format. Other providers translate to and from it.

### 3.4 Tool Definitions

Tools are defined using Anthropic-style JSON Schema and translated per-provider at request time:

**`query_database`** — Execute read-only SQL against PostgreSQL
- Input: `{ query: "SELECT ..." }`
- Returns: `{ rows, rowCount }`

**`search_codebase`** — Search files and code in a GitHub repository
- Input: `{ pattern: "**/*.js", content_search: "authenticate" }`
- Returns: file list or `{ matches: [{ file, lineNumber, content }] }`

**`fetch_logs`** — Retrieve server logs from cloud providers
- Input: `{ timeframe: "1h", level: "error", search: "timeout" }`
- Returns: `{ logs: [{ timestamp, level, message, source }] }`

### 3.5 Conversation Model

The frontend accumulates all messages in a Pinia store array. On every new message, it sends the **full conversation history** to the backend. The backend receives it, runs the agentic loop, and returns the final answer plus metadata about which tools were called. The backend stores nothing — it processes the request and forgets.

Tool call details (which tools were used, their inputs and outputs) are stored in the frontend for display in collapsible panels, but stripped from the message history before sending to the LLM — the model only sees the text content of prior turns.

---

## 4. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, Vite, Pinia, Vue Router |
| Backend | Node.js, Express |
| Database connector | `pg` (node-postgres) |
| Codebase connector | `fast-glob`, `git clone` (shallow) |
| Logs connector | Native `fetch` (Vercel API) |
| LLM SDKs | `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `@mistralai/mistralai` |
| Design | Custom CSS design system (dark theme, Inter + JetBrains Mono) |

No test framework or linter is configured — this is an MVP.

---

## 5. Design Language

The UI uses a dark-first design system with layered depth:

- **Background hierarchy:** `#0a0a0f` → `#12121a` → `#1a1a24` → `#22222e` (base → surface → elevated → hover)
- **Accent:** Pure white (`#ffffff`) with dim variant for subtle backgrounds
- **Typography:** Inter (UI) + JetBrains Mono (code/inputs)
- **Semantic colors:** Error red (`#ff4d6a`), success green (`#34d399`)
- **Borders:** Subtle white at 8% opacity, active at 15%

The visual identity is minimal, technical, and clean — designed for developers.

---

## 6. Current Scope & Roadmap Context

### What's built and working (v0.1.9)
- Full agentic loop with multi-turn conversation
- All 4 LLM providers with tool-use support
- PostgreSQL read-only queries with defense-in-depth security
- GitHub repository search (public repos via URL, shallow clone with caching)
- Vercel log retrieval with filtering
- Visual model selection with 20+ models across providers
- Collapsible tool call inspection in chat UI
- Colour-coded backend terminal logging

### Connector expansion planned
- **Database:** MySQL support (UI present, backend not yet implemented)
- **Codebase:** GitHub Token auth for private repos, Trajan integration (UI present, backend not yet implemented)
- **Logs:** 8 additional providers have UI configuration built (Fly.io, Grafana, AWS CloudWatch, Azure Monitor, Google Cloud, Redis, Datadog, Supabase) — backend implementations pending

---

## 7. Key Messaging Points for the Webpage

These are the angles that communicate Parsec's value:

1. **"One framework, any LLM"** — Not locked to OpenAI or Anthropic. Bring your own model, your own API key, your own preference. Parsec's provider abstraction means the same powerful tool-use works across all major LLMs.

2. **"Connect to what matters"** — Databases, codebases, and logs are where the answers live. Parsec connects to all three and lets an AI agent explore them autonomously.

3. **"Ask, don't query"** — Instead of writing SQL, crafting grep commands, or navigating log dashboards, just ask a question in plain English. The agent figures out what to query, search, or fetch.

4. **"Safe by design"** — Read-only database access with triple-layer enforcement. Path traversal protection on codebase search. Output caps on everything. The agent can explore freely without risk.

5. **"Nothing stored, nothing to breach"** — Fully stateless backend. API keys and credentials are passed per-request and never persisted. Self-host it and your data never leaves your network.

6. **"Open source, Apache 2.0"** — Use it, modify it, ship it. No license gotchas.

7. **"Agentic, not single-shot"** — The agent doesn't just answer once — it reasons, calls tools, reads results, and iterates up to 10 times to build a complete answer. It can chain database queries into codebase searches into log lookups.
