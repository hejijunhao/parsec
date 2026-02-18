# Parsec v2 — Vision

## What Parsec Is

Parsec is an **open-source Go framework** that normalizes operational data — databases, codebases, and server logs — into structured, token-efficient formats for AI agent consumption.

It is **infrastructure, not an agent.** Parsec does not reason, decide, or act. It ingests raw operational signals, normalizes them into a canonical schema, and serves them through a clean tool interface. Agents built with any framework (LangChain, Claude SDK, custom) consume Parsec's outputs.

### The Problem

Connecting an AI agent to operational data today means writing bespoke integration code for every source. This has two layers of inconsistency:

1. **Provider-level** — Vercel, AWS CloudWatch, Fly.io, Datadog all expose different APIs, auth mechanisms, and response shapes for fundamentally the same data (logs, metrics, errors).

2. **Application-level** — Even within a single log provider, every application logs differently. One service emits structured JSON with trace IDs, another dumps unstructured strings, a third mixes formats across endpoints. Field names, severity levels, error shapes, timestamp formats — all inconsistent.

The same applies to databases (different schemas, naming conventions, column types) and codebases (different structures, languages, file organizations).

Feeding this raw, heterogeneous data directly to an LLM is wasteful (tokens spent parsing noise), unreliable (inconsistent formats confuse reasoning), and slow (bloated payloads, repeated work).

### The Solution

Parsec sits between data sources and agents as a normalization layer:

```
Raw operational data (heterogeneous, noisy, verbose)
   ↓
PARSEC
   ↓
Structured, canonical, token-optimized data (uniform, compact, LLM-ready)
```

An agent developer imports Parsec, points it at their sources, and gets back clean, structured data without writing provider-specific or app-specific parsing code.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   CONNECTORS                     │
│   Database  │  Codebase  │  Logs/Telemetry       │
│  (Postgres, │ (GitHub,   │ (Vercel, AWS, Fly.io, │
│   MySQL)    │  GitLab)   │  Datadog, Grafana)    │
└──────┬──────┴─────┬──────┴──────┬────────────────┘
       │            │             │
       ▼            ▼             ▼
┌─────────────────────────────────────────────────┐
│              NORMALIZATION LAYER                  │
│                                                   │
│  Raw signals → Canonical events                   │
│  App-specific formats → Uniform schema            │
│  Verbose output → Token-optimized representation  │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              TOOL-SERVING INTERFACE               │
│                                                   │
│  Exposes normalized data as structured tool calls │
│  Any agent framework can consume                  │
└─────────────────────────────────────────────────┘
```

### Layer 1: Connectors

Thin adapters that pull data from external sources. Each connector handles auth, pagination, rate limiting, and raw data retrieval for a specific provider.

Design principles:
- Stateless — no connection pooling or session management in the connector itself
- Thin — minimal logic, just fetch and forward
- Pluggable — adding a new provider means implementing a small interface

Connector categories:
- **Database** — execute read-only queries (Postgres, MySQL, etc.)
- **Codebase** — clone/pull repos, search files and content (GitHub, GitLab, local)
- **Logs/Telemetry** — retrieve log streams, metrics, traces (Vercel, AWS, Fly.io, Datadog, Grafana, etc.)

### Layer 2: Normalization (Core Value)

This is where Parsec earns its place. The normalization layer transforms heterogeneous, app-specific data into a **small canonical ontology** — a finite set of structured event types.

**Why this matters:**

Without normalization, an agent receiving logs from two different services might see:

```
Service A:  {"level": "error", "msg": "connection timeout", "service": "payments", "ts": 1708300800}
Service B:  ERROR [2026-02-19 12:00:00] UserService — connection refused (host=db-primary, port=5432)
```

These represent the same class of event (a service-level connection failure) but look completely different. The agent wastes tokens parsing format, loses consistency across sources, and may reason about them differently despite equivalent semantics.

After Parsec normalization, both become:

```
{
  type: "ERROR",
  category: "CONNECTION_FAILURE",
  source: "payments" | "user-service",
  target: "downstream-dependency",
  timestamp: "2026-02-19T12:00:00Z",
  severity: "error",
  summary: "Connection timeout to db-primary:5432"
}
```

The same applies to DB results (uniform column typing, null handling, row formatting) and codebase data (uniform file/diff/search result structures).

**Canonical event types** (initial set, to be refined):
- `REQUEST` — HTTP/API request events
- `ERROR` — errors, exceptions, failures
- `DEPLOY` — deployment and release events
- `DATA_CHANGE` — schema migrations, significant data mutations
- `SYSTEM_SIGNAL` — health checks, resource alerts, scaling events
- `ACCESS` — auth events, permission changes

**Token optimization:**
- Strip redundant fields and metadata
- Compress repeated patterns
- Truncate intelligently (preserve diagnostic value)
- Batch related events into summaries where appropriate

### Layer 3: Tool-Serving Interface

Exposes normalized data through a standardized tool interface that any agent framework can consume. The interface is designed so that an agent framework (or an LLM with tool-use) can call Parsec tools and receive structured, canonical responses.

This layer handles:
- Tool definition schemas (compatible with OpenAI function calling, Anthropic tool use, etc.)
- Request validation and parameter handling
- Response formatting and size management

---

## Philosophy

### Deterministic execution

Parsec's processing path is fully deterministic. No LLM calls inside the ingestion or normalization pipeline. Given the same raw input, Parsec always produces the same canonical output. This makes it:
- Predictable — no variance between runs
- Debuggable — you can trace exactly why an output looks the way it does
- Fast — no API latency in the hot path
- Testable — straightforward input/output assertions

### Structure over intelligence

Parsec's job is to make operational reality **legible**. It does not interpret, reason, or decide. It structures. The intelligence lives in the agent consuming Parsec's outputs.

### Small canonical ontology

All signals map into a small, finite set of event types. This constraint is deliberate:
- Forces normalization to be meaningful (not just pass-through)
- Keeps the schema learnable by agents
- Reduces ambiguity in downstream reasoning
- Enables efficient batching and deduplication

---

## Technology

**Language:** Go

- Strong concurrency primitives (goroutines for parallel connector ingestion)
- Fast compilation and iteration speed
- Single binary deployment
- Rich ecosystem for HTTP, database drivers, and cloud SDKs
- Appropriate performance ceiling for this workload

Rust remains an option for future hot-path optimization if profiling warrants it.

**Distribution:** Go module, importable as a library. Optionally runnable as a standalone service.

---

## Relationship to Parsec v1 (Current MVP)

The current Node.js/Vue application (v0.1.x) is a **commercial product prototype** — a web app where users connect an agent to their data sources through a UI. Parsec v2 is the **framework that product would use under the hood**.

```
Parsec v1 (product)     →  uses  →  Parsec v2 (framework)
"Connect your agent        "Normalize operational data
 to your data"              for any agent"
```

---

## Future Layers (Not in Scope for v2 Initial Build)

These are noted for directional alignment but are explicitly deferred:

### Policy / Rule Engine
A deterministic scoring system that evaluates canonical events against configurable rules. Could enable things like anomaly detection, alerting thresholds, and priority scoring — without LLM involvement at runtime. Deferred until the normalization layer proves its value.

### Learning Loop
An async/offline feedback mechanism that refines normalization rules and policy weights over time based on event history and agent usage patterns. May use LLM services as policy optimizers (not runtime decision-makers). Deferred until there's enough usage data to learn from.

---

## Design Goals

1. Ultra-fast ingestion and normalization — no LLM in the hot path
2. Token-efficient canonical output — minimize waste for downstream agents
3. Dead-simple integration — `import parsec; parsec.Connect(sources); parsec.Query(tool_call)`
4. Provider-agnostic — same canonical output regardless of source
5. App-agnostic — handles inconsistent logging/schema conventions gracefully
6. Agent-agnostic — works with any LLM framework or direct SDK usage
7. Open-source (Apache 2.0)
