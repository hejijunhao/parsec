import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Creates a Google Gemini provider adapter.
 * Gemini has the most different API structure of all providers.
 *
 * Key differences:
 * - Stateful chat model — we reconstruct session from history each request
 * - Role mapping: 'assistant' → 'model'
 * - Messages use { role, parts: [{ text }] } structure
 * - Function calls returned via response.functionCalls() method
 * - Tool results use { functionResponse: { name, response } } format
 * - System prompt passed as systemInstruction in model config
 *
 * @param {import('./types.js').ProviderConfig} config
 * @returns {import('./types.js').ProviderAdapter}
 */
export function createGoogleAdapter(config) {
  const genAI = new GoogleGenerativeAI(config.apiKey)

  // Store reference for use in methods
  let currentModel = null
  let currentSystemPrompt = null

  /**
   * Convert our messages to Gemini's history format.
   * Handles both text messages and tool call/result pairs.
   */
  function formatHistory(messages) {
    const history = []

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : 'user'

      // Handle string content (simple text message)
      if (typeof msg.content === 'string') {
        history.push({
          role,
          parts: [{ text: msg.content }],
        })
        continue
      }

      // Handle array content (Anthropic-style tool blocks)
      if (Array.isArray(msg.content)) {
        const parts = []

        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text })
          } else if (block.type === 'tool_use') {
            // Model requested a function call
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            })
          } else if (block.type === 'tool_result') {
            // User providing function result
            parts.push({
              functionResponse: {
                name: block.name || 'unknown',
                response: safeJsonParse(block.content),
              },
            })
          }
        }

        if (parts.length > 0) {
          history.push({ role, parts })
        }
      }
    }

    return history
  }

  /**
   * Safely parse JSON, returning the string if parsing fails.
   */
  function safeJsonParse(str) {
    try {
      return JSON.parse(str)
    } catch {
      return { result: str }
    }
  }

  return {
    async chat(messages, tools, systemPrompt) {
      // Create model with system instruction
      currentSystemPrompt = systemPrompt
      currentModel = genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: systemPrompt || undefined,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      })

      // Build history from all messages except the last one
      const history = formatHistory(messages.slice(0, -1))

      // Get the last message to send
      const lastMessage = messages[messages.length - 1]

      // Start chat with history and send the last message
      const chat = currentModel.startChat({ history })

      // Format the last message content
      let sendContent
      if (typeof lastMessage.content === 'string') {
        sendContent = lastMessage.content
      } else if (Array.isArray(lastMessage.content)) {
        // Handle tool results being sent back
        const parts = lastMessage.content.map(block => {
          if (block.type === 'tool_result') {
            return {
              functionResponse: {
                name: block.name || 'unknown',
                response: safeJsonParse(block.content),
              },
            }
          }
          if (block.type === 'text') {
            return { text: block.text }
          }
          return { text: JSON.stringify(block) }
        })
        sendContent = parts
      }

      return chat.sendMessage(sendContent)
    },

    translateTools(toolDefinitions) {
      // Gemini format: { name, description, parameters }
      return toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      }))
    },

    extractToolCalls(response) {
      const functionCalls = response.response.functionCalls()
      if (!functionCalls || functionCalls.length === 0) return []

      return functionCalls.map((fc, idx) => ({
        id: `gemini-${Date.now()}-${idx}`,
        name: fc.name,
        input: fc.args,
      }))
    },

    extractText(response) {
      try {
        return response.response.text() || ''
      } catch {
        // text() throws if the response only contains function calls
        return ''
      }
    },

    requiresToolExecution(response) {
      const functionCalls = response.response.functionCalls()
      return functionCalls && functionCalls.length > 0
    },

    formatToolResults(toolResults) {
      // For Gemini, we need to format as functionResponse parts
      return toolResults.map(result => ({
        type: 'tool_result',
        name: result.name,
        content: result.content,
      }))
    },

    appendToConversation(messages, response, toolResults) {
      // Get the function calls from the response to include in assistant message
      const functionCalls = response.response.functionCalls() || []

      // Build the assistant message with function calls
      const assistantContent = []

      // Add any text content
      try {
        const text = response.response.text()
        if (text) {
          assistantContent.push({ type: 'text', text })
        }
      } catch {
        // No text content
      }

      // Add function call blocks (using our normalized format for storage)
      for (const fc of functionCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: `gemini-${Date.now()}`,
          name: fc.name,
          input: fc.args,
        })
      }

      // Build the user message with tool results
      const toolResultContent = this.formatToolResults(toolResults)

      return [
        ...messages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolResultContent },
      ]
    },
  }
}
