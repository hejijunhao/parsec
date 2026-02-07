# Multi-Provider Support — Completion Notes

**Completed:** 2026-02-07
**Version:** 0.1.8
**Plan:** `docs/executing/multi-provider-support.md` → `docs/archive/`

---

## Summary

Implemented backend support for all 4 LLM providers (Anthropic, OpenAI, Google Gemini, Mistral) through a unified provider abstraction layer. The frontend already had provider/model selection UI; this work enables the backend to actually use those providers.

---

## What Was Built

### Provider Abstraction Layer

Created `backend/src/providers/` with a factory pattern:

```
providers/
├── index.js      # Factory: createProvider(config) → adapter
├── types.js      # JSDoc type definitions
├── anthropic.js  # Anthropic Claude adapter
├── openai.js     # OpenAI GPT adapter
├── google.js     # Google Gemini adapter
└── mistral.js    # Mistral adapter
```

### Provider Interface

Each adapter implements 7 methods:

| Method | Purpose |
|--------|---------|
| `chat(messages, tools, systemPrompt)` | Send messages to the model |
| `translateTools(toolDefinitions)` | Convert our tool format to provider's format |
| `extractToolCalls(response)` | Extract tool calls from response |
| `extractText(response)` | Extract text content from response |
| `requiresToolExecution(response)` | Check if model wants to use tools |
| `formatToolResults(toolResults)` | Format tool results for the provider |
| `appendToConversation(messages, response, toolResults)` | Build conversation history |

### Provider-Specific Details

| Provider | Tool Format | System Prompt | Tool Results | Notes |
|----------|-------------|---------------|--------------|-------|
| Anthropic | `input_schema` (canonical) | Top-level field | `tool_result` in user message | Our canonical format |
| OpenAI | `{ type: 'function', function: {...} }` | System message | `role: 'tool'` messages | snake_case properties |
| Mistral | Same as OpenAI | System message | `role: 'tool'` messages | camelCase properties |
| Google | `{ name, description, parameters }` | `systemInstruction` | `functionResponse` parts | Stateful chat API |

### Agentic Loop Refactor

Refactored `routes/chat.js` from:
```javascript
// Before: Hardcoded Anthropic
const client = createClaudeClient(config)
response = await client.messages.create({...})
if (response.stop_reason === 'tool_use') {...}
```

To:
```javascript
// After: Provider-agnostic
const provider = createProvider(config)
const tools = provider.translateTools(toolDefinitions)
response = await provider.chat(messages, tools, systemPrompt)
if (provider.requiresToolExecution(response)) {...}
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/providers/index.js` | Created — factory |
| `backend/src/providers/types.js` | Created — JSDoc types |
| `backend/src/providers/anthropic.js` | Created — refactored from client.js |
| `backend/src/providers/openai.js` | Created |
| `backend/src/providers/google.js` | Created |
| `backend/src/providers/mistral.js` | Created |
| `backend/src/routes/chat.js` | Refactored — now provider-agnostic |
| `backend/src/claude/client.js` | **Deleted** |
| `backend/scripts/test-providers.js` | Created — test script |
| `backend/package.json` | Added openai, @google/generative-ai, @mistralai/mistralai |
| `CLAUDE.md` | Updated architecture docs |
| `docs/changelog.md` | Added 0.1.8 entry |

---

## Dependencies Added

```json
{
  "openai": "^4.x",
  "@google/generative-ai": "^0.x",
  "@mistralai/mistralai": "^1.x"
}
```

---

## Key Decisions

### 1. Adapter Pattern vs. Strategy Pattern

Chose **adapter pattern** because each provider has fundamentally different APIs that need translation. The adapter wraps each SDK and exposes a uniform interface.

### 2. Canonical Tool Format

Used **Anthropic's `input_schema` format** as canonical because:
- It's the cleanest format (no nesting)
- It matches JSON Schema directly
- Other providers need translation anyway

### 3. Gemini Stateful Chat Handling

Gemini's chat API is inherently stateful (`startChat` with history). We handle this by:
- Reconstructing the chat session from message history each request
- Converting our message format to Gemini's `{ role, parts }` format
- Handling `functionCall`/`functionResponse` pairs in history

### 4. Error Message for Unimplemented Providers

Kept the helpful error message pattern from MVP but now it's dynamic:
```javascript
if (!factory) {
  throw new Error(`Provider "${provider}" is not yet implemented. Currently supported: ${implementedProviders.join(', ')}.`)
}
```

---

## Testing

Created `backend/scripts/test-providers.js` for quick validation:

```bash
node scripts/test-providers.js anthropic sk-ant-xxx
node scripts/test-providers.js openai sk-xxx gpt-4.1
node scripts/test-providers.js google AIza... gemini-2.5-flash
node scripts/test-providers.js mistral xxx mistral-large-latest
```

### Manual Testing Checklist

- [ ] Anthropic: basic query, tool call, multi-turn
- [ ] OpenAI: basic query, tool call, multi-turn
- [ ] Google: basic query, tool call, multi-turn
- [ ] Mistral: basic query, tool call, multi-turn

---

## Known Limitations

1. **Gemini tool results** — The `functionResponse` format requires the tool name, which we now include in `ToolResult`

2. **Mistral SDK** — Uses camelCase for all properties (`toolCalls`, `finishReason`, `toolCallId`)

3. **No parallel tool calls** — Currently executes tool calls sequentially; could be optimized

4. **Error handling** — Provider-specific errors are caught but could use more specific error types

---

## Future Improvements

1. **Add xAI Grok** — Similar to OpenAI format
2. **Streaming support** — All providers support streaming; would need interface extension
3. **Token counting** — Each provider has different token limits
4. **Rate limit handling** — Add retry logic with exponential backoff
