import OpenAI from 'openai'

/**
 * Creates an OpenAI provider adapter.
 * OpenAI uses function calling with a different message structure than Anthropic.
 *
 * Key differences:
 * - System prompt is a message with role: 'system' (not a top-level field)
 * - Tools use { type: 'function', function: { name, description, parameters } }
 * - Tool results are separate messages with role: 'tool'
 * - Stop reason is 'tool_calls' (not 'tool_use')
 *
 * @param {import('./types.js').ProviderConfig} config
 * @returns {import('./types.js').ProviderAdapter}
 */
export function createOpenAIAdapter(config) {
  const client = new OpenAI({ apiKey: config.apiKey })

  return {
    async chat(messages, tools, systemPrompt) {
      // OpenAI uses system prompt as a message, not a top-level field
      const formattedMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages

      return client.chat.completions.create({
        model: config.model,
        messages: formattedMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      })
    },

    translateTools(toolDefinitions) {
      // OpenAI format: { type: 'function', function: { name, description, parameters } }
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
      // OpenAI expects each tool result as a separate message with role: 'tool'
      return toolResults.map(result => ({
        role: 'tool',
        tool_call_id: result.toolCallId,
        content: result.content,
      }))
    },

    appendToConversation(messages, response, toolResults) {
      // OpenAI: append the assistant message, then each tool result as a separate message
      return [
        ...messages,
        response.choices[0].message,
        ...this.formatToolResults(toolResults),
      ]
    },
  }
}
