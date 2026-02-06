# 04 — Wire Up Chat UI (Frontend + Backend)

**Files:**
- `frontend/src/views/AgentView.vue` — send messages, display responses
- `frontend/src/stores/appStore.js` — add loading state, richer message structure
- `backend/src/routes/chat.js` — fix the agentic loop, support conversation history
**New dependencies:** None
**Parallel:** Yes — no dependency on other workstreams

---

## Current State

### Frontend (`AgentView.vue`)
- Has a chat UI with message list and input form
- The `send()` function adds the user message to the store but has a TODO for the actual POST
- Messages are stored as `{ role, content }` — no support for tool usage display

### Store (`appStore.js`)
- Stores `connectors`, `agentConfig`, `messages`
- Has `addMessage(role, content)` and `clearMessages()`
- No loading/error state

### Backend (`chat.js`)
- Accepts `{ message, config, connectors }` — only a single message, no conversation history
- Calls Claude with tool definitions
- Executes tools if Claude requests them, but **does not send tool results back to Claude**
- This means Claude never gets to see the data it requested — it can't formulate a response based on tool results

**The backend has a critical architectural gap:** the agentic tool-use loop is incomplete. Claude's tool-calling flow requires multiple round-trips:

```
User message → Claude (may request tools) → Execute tools → Send results back to Claude → Claude responds
```

The current code stops after executing tools and returns raw results to the frontend, never letting Claude see the data.

---

## Implementation Plan

### Phase 1: Fix the backend agentic loop (`chat.js`)

**Goal:** After Claude requests tools and we execute them, send the tool results back to Claude so it can produce a final text response.

Steps:

1. Accept `messages` (array) instead of a single `message` string, to support conversation history. Fall back to wrapping a single `message` in an array for backwards compatibility.

2. Implement the agentic loop:
   ```
   while response.stop_reason === 'tool_use':
     execute all requested tools
     append tool results to messages
     call Claude again with updated messages
   return final response
   ```

3. Cap the loop at a maximum of 10 iterations to prevent infinite loops.

4. Return the full conversation flow (tool calls + final response) so the frontend can display what happened.

```js
chatRouter.post('/chat', async (req, res) => {
  const { message, messages: incomingMessages, config, connectors } = req.body

  try {
    const client = createClaudeClient(config)

    // Support both single message and conversation history
    let messages = incomingMessages || [{ role: 'user', content: message }]

    const toolCalls = []   // Track tool usage for the frontend
    let response
    let iterations = 0
    const MAX_ITERATIONS = 10

    while (iterations < MAX_ITERATIONS) {
      iterations++

      response = await client.messages.create({
        model: config.model,
        max_tokens: 4096,
        system: config.systemPrompt || undefined,
        tools: toolDefinitions,
        messages,
      })

      // If Claude didn't request any tools, we're done
      if (response.stop_reason !== 'tool_use') break

      // Execute each tool Claude requested
      const toolResultBlocks = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let result
          try {
            result = await executeTool(block.name, block.input, connectors)
          } catch (err) {
            result = { error: err.message }
          }

          toolCalls.push({ tool: block.name, input: block.input, result })
          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }

      // Append assistant response + tool results to messages for next iteration
      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResultBlocks },
      ]
    }

    // Extract final text from the last response
    const textBlocks = response.content.filter(b => b.type === 'text')
    const finalText = textBlocks.map(b => b.text).join('\n')

    res.json({
      content: finalText,
      toolCalls,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
```

**Key changes from the current code:**
- Implements the full tool-use loop (was missing)
- Sends tool results back to Claude using `tool_result` blocks with `tool_use_id`
- Catches tool execution errors and sends them as error results (Claude can self-correct)
- Tracks all tool calls for frontend visibility
- Returns final text content + tool call log

### Phase 2: Update the Pinia store (`appStore.js`)

**Goal:** Add loading state, error state, and a richer message structure that includes tool usage.

Steps:

1. Add `loading` ref (boolean) and `error` ref (string or null)
2. Update `addMessage` to support tool call metadata:
   ```js
   // Messages can now be:
   // { role: 'user', content: 'text' }
   // { role: 'assistant', content: 'text', toolCalls: [...] }
   // { role: 'error', content: 'error message' }
   ```
3. Add a `sendMessage` action that handles the full flow: add user message → set loading → POST to API → add assistant message → clear loading

```js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const connectors = ref({
    database: { type: '', connectionString: '' },
    codebase: { path: '' },
    logs: { provider: '', apiKey: '', projectId: '' },
  })

  const agentConfig = ref({
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: '',
  })

  const messages = ref([])
  const loading = ref(false)
  const error = ref(null)

  function addMessage(role, content, toolCalls = null) {
    messages.value.push({ role, content, ...(toolCalls && { toolCalls }) })
  }

  function clearMessages() {
    messages.value = []
  }

  async function sendMessage(text) {
    if (!text.trim()) return
    error.value = null
    addMessage('user', text)
    loading.value = true

    try {
      // Build conversation history for the API
      // Send only role + content (the backend doesn't need toolCalls metadata)
      const history = messages.value
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          config: agentConfig.value,
          connectors: connectors.value,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${response.status})`)
      }

      const data = await response.json()
      addMessage('assistant', data.content, data.toolCalls)
    } catch (err) {
      error.value = err.message
      addMessage('error', err.message)
    } finally {
      loading.value = false
    }
  }

  return { connectors, agentConfig, messages, loading, error, addMessage, clearMessages, sendMessage }
})
```

### Phase 3: Wire up the AgentView component (`AgentView.vue`)

**Goal:** Call `sendMessage`, show loading state, display tool usage, handle errors.

Steps:

1. Replace the `send()` function with a call to `store.sendMessage(text)`
2. Add a loading indicator (disable input + show spinner/text while waiting)
3. Display tool calls in assistant messages (collapsible section showing which tools were called and their results)
4. Show errors visually
5. Auto-scroll to the bottom when new messages arrive

```vue
<template>
  <div class="agent-view">
    <h1>Agent</h1>

    <div class="messages" ref="messagesContainer">
      <div v-for="(msg, i) in store.messages" :key="i" :class="['message', msg.role]">
        <!-- User message -->
        <template v-if="msg.role === 'user'">
          <strong>You:</strong> {{ msg.content }}
        </template>

        <!-- Assistant message -->
        <template v-else-if="msg.role === 'assistant'">
          <strong>Agent:</strong>
          <div class="assistant-content">{{ msg.content }}</div>

          <!-- Tool calls (if any) -->
          <details v-if="msg.toolCalls && msg.toolCalls.length" class="tool-calls">
            <summary>Tools used ({{ msg.toolCalls.length }})</summary>
            <div v-for="(tc, j) in msg.toolCalls" :key="j" class="tool-call">
              <strong>{{ tc.tool }}</strong>
              <pre class="tool-input">{{ JSON.stringify(tc.input, null, 2) }}</pre>
              <pre class="tool-result">{{ JSON.stringify(tc.result, null, 2) }}</pre>
            </div>
          </details>
        </template>

        <!-- Error message -->
        <template v-else-if="msg.role === 'error'">
          <strong>Error:</strong> {{ msg.content }}
        </template>
      </div>

      <!-- Loading indicator -->
      <div v-if="store.loading" class="message assistant loading">
        <em>Thinking...</em>
      </div>
    </div>

    <form @submit.prevent="send">
      <input
        v-model="input"
        type="text"
        placeholder="Ask the agent..."
        :disabled="store.loading"
      />
      <button type="submit" :disabled="store.loading || !input.trim()">
        {{ store.loading ? 'Sending...' : 'Send' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const input = ref('')
const messagesContainer = ref(null)

async function send() {
  const text = input.value.trim()
  if (!text || store.loading) return

  input.value = ''
  await store.sendMessage(text)
}

// Auto-scroll to bottom when messages change
watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
)
</script>
```

### Phase 4: Conversation history

**Goal:** Support multi-turn conversations where Claude remembers earlier messages.

This is already handled by the design above:

1. The store accumulates all messages in `messages.value`
2. `sendMessage()` sends the full conversation history (user + assistant messages) to the backend
3. The backend passes the full `messages` array to Claude

**Important nuance:** The conversation history sent to the backend should contain only the simple `{ role, content }` pairs — not the tool call metadata (which is for frontend display only). The backend reconstructs the tool-use flow internally via the agentic loop on each request.

However, this means each request only has the **text** history, not the tool interactions from previous turns. This is intentional for the MVP (stateless design), and Claude will still have context from the conversation text. Full tool-use history replay is a post-MVP enhancement.

---

## Summary of Changes

| File | What Changes |
|------|-------------|
| `backend/src/routes/chat.js` | Add agentic loop, accept message history, return structured response |
| `frontend/src/stores/appStore.js` | Add `loading`, `error`, `sendMessage()`, richer message structure |
| `frontend/src/views/AgentView.vue` | Wire up `sendMessage`, loading UI, tool call display, auto-scroll, error display |

---

## Verification

1. **Basic flow:** Type a message → see loading state → see response appear. No tools needed — just ask "What is 2+2?".

2. **Tool flow:** Configure a codebase connector with a local path. Ask "What files are in this project?" → verify tool call appears in collapsible section → verify Claude's text response references the file list.

3. **Error handling:** Don't configure an API key. Send a message → verify a clear error is displayed (not a crash).

4. **Multi-turn:** Send a follow-up question referencing the first answer. Verify Claude has context from the earlier turn.

5. **Loading state:** While waiting for a response, verify the input is disabled and "Thinking..." appears.
