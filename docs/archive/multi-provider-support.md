# Multi-Provider Support Implementation Plan

**Goal:** Enable Parsec to use any LLM provider (Anthropic, OpenAI, Google, Mistral) as the agentic harness while maintaining the same tool execution flow.

**Current State:**
- Frontend already has provider/model selection UI for all 4 providers
- Backend only implements Anthropic; other providers return a 400 error
- Tool definitions use Anthropic's `input_schema` format
- Agentic loop in `chat.js` is hardcoded to Claude SDK patterns

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         chat.js                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Provider Abstraction                      │  │
│  │  createProvider(config) → { chat(), translateTools() }    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│       ┌──────────────────────┼──────────────────────┐           │
│       ▼                      ▼                      ▼           │
│  ┌─────────┐          ┌──────────┐          ┌───────────┐       │
│  │Anthropic│          │  OpenAI  │          │  Google   │  ...  │
│  │ Adapter │          │  Adapter │          │  Adapter  │       │
│  └─────────┘          └──────────┘          └───────────┘       │
│       │                      │                      │           │
│       ▼                      ▼                      ▼           │
│  @anthropic-ai/sdk      openai SDK         @google/genai       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Provider Abstraction Layer

**Objective:** Create a unified interface that all provider adapters implement.

### Task 1.1: Define Provider Interface

Create `backend/src/providers/types.js` with JSDoc type definitions:

```javascript
/**
 * @typedef {Object} ProviderAdapter
 * @property {function(Message[], Tool[]): Promise<ProviderResponse>} chat
 * @property {function(ToolDefinition[]): any[]} translateTools
 * @property {function(any): ToolCall[]} extractToolCalls
 * @property {function(any): string} extractText
 * @property {function(any): boolean} requiresToolExecution
 */

/**
 * @typedef {Object} ToolCall
 * @property {string} id - Unique identifier for this tool invocation
 * @property {string} name - Tool name (e.g., 'query_database')
 * @property {Object} input - Tool input arguments
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} toolCallId - ID of the tool call this result is for
 * @property {string} content - JSON-stringified result
 */
```

### Task 1.2: Create Provider Factory

Create `backend/src/providers/index.js`:

```javascript
import { createAnthropicAdapter } from './anthropic.js'
import { createOpenAIAdapter } from './openai.js'
import { createGoogleAdapter } from './google.js'
import { createMistralAdapter } from './mistral.js'

const adapters = {
  anthropic: createAnthropicAdapter,
  openai: createOpenAIAdapter,
  google: createGoogleAdapter,
  mistral: createMistralAdapter,
}

export function createProvider(config) {
  const factory = adapters[config.provider]
  if (!factory) {
    throw new Error(`Unsupported provider: ${config.provider}`)
  }
  return factory(config)
}
```

### Task 1.3: Refactor Anthropic to Adapter Pattern

Move `backend/src/claude/client.js` → `backend/src/providers/anthropic.js` and refactor:

```javascript
import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicAdapter(config) {
  const client = new Anthropic({ apiKey: config.apiKey })

  return {
    async chat(messages, tools, systemPrompt) {
      return client.messages.create({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        tools,
        messages,
      })
    },

    translateTools(toolDefinitions) {
      // Anthropic uses our native format
      return toolDefinitions
    },

    extractToolCalls(response) {
      return response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ id: b.id, name: b.name, input: b.input }))
    },

    extractText(response) {
      return response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
    },

    requiresToolExecution(response) {
      return response.stop_reason === 'tool_use'
    },

    formatToolResults(toolResults) {
      return toolResults.map(r => ({
        type: 'tool_result',
        tool_use_id: r.toolCallId,
        content: r.content,
      }))
    },

    appendToConversation(messages, response, toolResults) {
      return [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: this.formatToolResults(toolResults) },
      ]
    },
  }
}
```

### Task 1.4: Update `chat.js` to Use Provider Abstraction

Refactor the agentic loop to be provider-agnostic:

```javascript
import { createProvider } from '../providers/index.js'
import { toolDefinitions, executeTool } from '../tools/index.js'

// In the /chat handler:
const provider = createProvider(config)
const tools = provider.translateTools(toolDefinitions)

let messages = incomingMessages || [{ role: 'user', content: message }]
const toolCalls = []
let response

while (iterations < MAX_ITERATIONS) {
  response = await provider.chat(messages, tools, config.systemPrompt)

  if (!provider.requiresToolExecution(response)) break

  const calls = provider.extractToolCalls(response)
  const toolResults = []

  for (const call of calls) {
    let result
    try {
      result = await executeTool(call.name, call.input, connectors)
    } catch (err) {
      result = { error: err.message }
    }
    toolCalls.push({ tool: call.name, input: call.input, result })
    toolResults.push({ toolCallId: call.id, content: JSON.stringify(result) })
  }

  messages = provider.appendToConversation(messages, response, toolResults)
  iterations++
}

const finalText = provider.extractText(response)
```

---

## Phase 2: OpenAI Adapter

**Objective:** Implement OpenAI function calling support.

### Task 2.1: Install OpenAI SDK

```bash
cd backend && npm install openai
```

### Task 2.2: Create OpenAI Adapter

Create `backend/src/providers/openai.js`:

```javascript
import OpenAI from 'openai'

export function createOpenAIAdapter(config) {
  const client = new OpenAI({ apiKey: config.apiKey })

  return {
    async chat(messages, tools, systemPrompt) {
      const formattedMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages

      return client.chat.completions.create({
        model: config.model,
        messages: formattedMessages,
        tools,
        tool_choice: 'auto',
      })
    },

    translateTools(toolDefinitions) {
      // OpenAI uses { type: 'function', function: { name, description, parameters } }
      return toolDefinitions.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }))
    },

    extractToolCalls(response) {
      const message = response.choices[0].message
      if (!message.tool_calls) return []
      return message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }))
    },

    extractText(response) {
      return response.choices[0].message.content || ''
    },

    requiresToolExecution(response) {
      return response.choices[0].finish_reason === 'tool_calls'
    },

    formatToolResults(toolResults) {
      return toolResults.map(r => ({
        role: 'tool',
        tool_call_id: r.toolCallId,
        content: r.content,
      }))
    },

    appendToConversation(messages, response, toolResults) {
      return [
        ...messages,
        response.choices[0].message,
        ...this.formatToolResults(toolResults),
      ]
    },
  }
}
```

### Task 2.3: Test OpenAI Integration

- Test with GPT-4.1 and GPT-4o models
- Verify tool calling works end-to-end
- Confirm conversation history format is correct

---

## Phase 3: Google Gemini Adapter

**Objective:** Implement Google Gemini function calling support.

### Task 3.1: Install Google Generative AI SDK

```bash
cd backend && npm install @google/generative-ai
```

### Task 3.2: Create Google Adapter

Create `backend/src/providers/google.js`:

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'

export function createGoogleAdapter(config) {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  const model = genAI.getGenerativeModel({ model: config.model })

  return {
    async chat(messages, tools, systemPrompt) {
      const chat = model.startChat({
        history: this.formatHistory(messages.slice(0, -1)),
        systemInstruction: systemPrompt || undefined,
        tools: [{ functionDeclarations: tools }],
      })

      const lastMessage = messages[messages.length - 1]
      return chat.sendMessage(lastMessage.content)
    },

    formatHistory(messages) {
      return messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: typeof m.content === 'string'
          ? [{ text: m.content }]
          : m.content,
      }))
    },

    translateTools(toolDefinitions) {
      // Gemini uses { name, description, parameters }
      return toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      }))
    },

    extractToolCalls(response) {
      const functionCalls = response.response.functionCalls()
      if (!functionCalls) return []
      return functionCalls.map((fc, idx) => ({
        id: `gemini-${Date.now()}-${idx}`,
        name: fc.name,
        input: fc.args,
      }))
    },

    extractText(response) {
      return response.response.text() || ''
    },

    requiresToolExecution(response) {
      const calls = response.response.functionCalls()
      return calls && calls.length > 0
    },

    formatToolResults(toolResults) {
      return toolResults.map(r => ({
        functionResponse: {
          name: r.toolName,
          response: JSON.parse(r.content),
        },
      }))
    },

    appendToConversation(messages, response, toolResults) {
      // Gemini handles this internally via chat.sendMessage
      // For multi-turn, we need to track tool results differently
      return messages // Simplified - needs refinement
    },
  }
}
```

### Task 3.3: Handle Gemini Chat Session State

**Note:** Gemini's chat API is stateful (uses `startChat` with history). We may need to:
- Reconstruct the chat session each request (since backend is stateless)
- Handle function call/response pairs in history format

---

## Phase 4: Mistral Adapter

**Objective:** Implement Mistral function calling support.

### Task 4.1: Install Mistral SDK

```bash
cd backend && npm install @mistralai/mistralai
```

### Task 4.2: Create Mistral Adapter

Create `backend/src/providers/mistral.js`:

```javascript
import Mistral from '@mistralai/mistralai'

export function createMistralAdapter(config) {
  const client = new Mistral({ apiKey: config.apiKey })

  return {
    async chat(messages, tools, systemPrompt) {
      const formattedMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages

      return client.chat.complete({
        model: config.model,
        messages: formattedMessages,
        tools,
        toolChoice: 'auto',
      })
    },

    translateTools(toolDefinitions) {
      // Mistral uses OpenAI-compatible format
      return toolDefinitions.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }))
    },

    extractToolCalls(response) {
      const message = response.choices[0].message
      if (!message.toolCalls) return []
      return message.toolCalls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }))
    },

    extractText(response) {
      return response.choices[0].message.content || ''
    },

    requiresToolExecution(response) {
      return response.choices[0].finishReason === 'tool_calls'
    },

    formatToolResults(toolResults) {
      return toolResults.map(r => ({
        role: 'tool',
        toolCallId: r.toolCallId,
        content: r.content,
      }))
    },

    appendToConversation(messages, response, toolResults) {
      return [
        ...messages,
        response.choices[0].message,
        ...this.formatToolResults(toolResults),
      ]
    },
  }
}
```

---

## Phase 5: Testing & Validation

### Task 5.1: Create Provider Test Script

Create `backend/scripts/test-providers.js` to validate each provider:

```javascript
// Test script that exercises each provider with a simple tool call
// Run with: node scripts/test-providers.js <provider> <api-key>
```

### Task 5.2: Manual Integration Tests

For each provider, verify:
- [ ] Basic text response (no tools)
- [ ] Single tool call + response
- [ ] Multi-turn conversation with tools
- [ ] Tool error handling
- [ ] Conversation history preservation

### Task 5.3: Update Error Messages

Ensure all provider-specific errors are caught and surfaced clearly to the user.

---

## Phase 6: Documentation & Cleanup

### Task 6.1: Update CLAUDE.md

- Add providers architecture section
- Document how to add new providers
- Update the request flow diagram

### Task 6.2: Update Changelog

Add entry for multi-provider support.

### Task 6.3: Remove Legacy Code

- Delete `backend/src/claude/` directory
- Remove `SUPPORTED_PROVIDERS` check from chat.js
- Clean up any unused imports

---

## File Changes Summary

| File | Action |
|------|--------|
| `backend/src/providers/index.js` | Create (factory) |
| `backend/src/providers/types.js` | Create (JSDoc types) |
| `backend/src/providers/anthropic.js` | Create (refactored from client.js) |
| `backend/src/providers/openai.js` | Create |
| `backend/src/providers/google.js` | Create |
| `backend/src/providers/mistral.js` | Create |
| `backend/src/routes/chat.js` | Refactor (use provider abstraction) |
| `backend/src/claude/client.js` | Delete |
| `backend/package.json` | Add openai, @google/generative-ai, @mistralai/mistralai |

---

## Dependencies to Add

```json
{
  "openai": "^4.x",
  "@google/generative-ai": "^0.x",
  "@mistralai/mistralai": "^1.x"
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Provider SDK breaking changes | Pin exact versions, add integration tests |
| Gemini stateful chat model | Reconstruct chat session from history each request |
| Different tool result formats | Adapter normalizes all formats internally |
| Rate limiting per provider | Return provider-specific error messages |
| Model deprecation | Frontend model list is easy to update |

---

## Implementation Order

1. **Phase 1** — Abstraction layer + refactored Anthropic (no new deps, low risk)
2. **Phase 2** — OpenAI (most similar to Anthropic's patterns)
3. **Phase 4** — Mistral (OpenAI-compatible API)
4. **Phase 3** — Google Gemini (most different API patterns)
5. **Phase 5** — Testing across all providers
6. **Phase 6** — Documentation and cleanup

---

## Success Criteria

- [ ] All 4 providers return correct responses for basic queries
- [ ] Tool execution works identically across all providers
- [ ] Conversation history is preserved correctly
- [ ] Errors are surfaced with provider-specific context
- [ ] No regression in Anthropic behavior
