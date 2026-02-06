# 04 — Wire Up Chat UI (Frontend + Backend) — Completion Notes

**Plan:** `docs/executing/04-chat-ui-wiring.md`
**Status:** Implemented
**Date:** 2026-02-06

---

## What was modified

Three files changed, matching the plan exactly. No new files or dependencies added.

### `backend/src/routes/chat.js`

**Why:** The existing code had a critical gap — it executed tools Claude requested but never sent the results back to Claude. Claude couldn't formulate responses based on tool data.

**What changed:**

- Accepts `messages` (array) in addition to single `message` string, with backwards compatibility fallback
- Implements the full agentic tool-use loop:
  ```
  while stop_reason === 'tool_use' (max 10 iterations):
    execute all requested tools
    append assistant content + tool_result blocks to messages
    call Claude again
  return final text + tool call log
  ```
- Tool execution errors are caught per-tool and sent back to Claude as error results (allows self-correction instead of crashing the whole request)
- Tool results sent back using proper `tool_result` blocks with `tool_use_id` matching
- All tool calls tracked in a `toolCalls` array returned to the frontend for display
- Response shape changed from `{ content: [...blocks], toolResults }` to `{ content: "final text", toolCalls: [...] }`

### `frontend/src/stores/appStore.js`

**Why:** The store had no loading/error state and no way to actually make API calls — `addMessage` only pushed to the local array.

**What changed:**

- Added `loading` ref (boolean) and `error` ref (string | null)
- `addMessage(role, content, toolCalls?)` now accepts optional `toolCalls` parameter, attached to the message object when present
- Added `sendMessage(text)` async action that handles the full flow:
  1. Clears error state, adds user message, sets loading
  2. Builds conversation history (filters to user/assistant roles, strips frontend-only metadata)
  3. POSTs to `/api/chat` with `{ messages, config, connectors }`
  4. On success: adds assistant message with `toolCalls` metadata
  5. On failure: sets `error`, adds an error-role message
  6. Always clears `loading` in `finally`
- Exported `loading`, `error`, `sendMessage` alongside existing exports

### `frontend/src/views/AgentView.vue`

**Why:** The component had a stub `send()` with a TODO comment — it added user messages to the store but never contacted the backend.

**What changed:**

- `send()` now calls `store.sendMessage(text)` and guards against double-sends while loading
- Input field clears immediately on send (before awaiting response)
- Input and button disabled while `store.loading` is true
- Button text toggles between "Send" / "Sending..."
- Messages display differentiated by role:
  - **User:** `You: <text>`
  - **Assistant:** `Agent: <text>` with collapsible `<details>` section showing tool calls (tool name, input JSON, result JSON)
  - **Error:** `Error: <text>`
- Loading indicator: "Thinking..." message appears at bottom of chat while waiting
- Auto-scroll: `watch` on `store.messages.length` scrolls the container to bottom after each new message via `nextTick`
- Template ref `messagesContainer` added for scroll targeting

---

## Conversation history (Phase 4)

Multi-turn conversation is handled by the design of the above changes without additional code:

1. The store accumulates all messages in `messages.value`
2. `sendMessage()` sends the full user/assistant history to the backend
3. The backend passes the full `messages` array to Claude

**Intentional limitation (MVP):** Only text history is sent between turns — tool interactions from previous turns are not replayed. Claude still has conversational context from the text. Full tool-use history replay is a post-MVP enhancement, as noted in the plan.

---

## Architectural notes

- **No new dependencies** — uses built-in `fetch` on both sides (Node 18+ on backend, browser on frontend)
- **Vite proxy** (`/api` → `localhost:3000`) was already configured — no changes needed
- **Stateless design preserved** — credentials still passed per-request, no sessions
- **Max 10 tool-use iterations** caps runaway loops where Claude keeps requesting tools

---

## What this unblocks

This was the final wiring needed to make the three tool adapters (01-database, 02-codebase, 03-logs) reachable from the UI. The end-to-end flow is now complete:

```
User types in AgentView → store.sendMessage() → POST /api/chat
  → Claude SDK call with tools → agentic loop (tool execution + result feedback)
  → final text response → displayed in AgentView with tool call details
```
