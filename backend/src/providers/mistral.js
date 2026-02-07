import { Mistral } from '@mistralai/mistralai'

/**
 * Creates a Mistral provider adapter.
 * Mistral uses an OpenAI-compatible API with minor differences.
 *
 * Key differences from OpenAI:
 * - SDK method is chat.complete() not chat.completions.create()
 * - Uses camelCase: toolCalls, toolChoice, finishReason, toolCallId
 * - Response structure is slightly different but similar
 *
 * @param {import('./types.js').ProviderConfig} config
 * @returns {import('./types.js').ProviderAdapter}
 */
export function createMistralAdapter(config) {
  const client = new Mistral({ apiKey: config.apiKey })

  return {
    async chat(messages, tools, systemPrompt) {
      // Mistral uses system prompt as a message, like OpenAI
      const formattedMessages = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages

      return client.chat.complete({
        model: config.model,
        messages: formattedMessages,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: tools.length > 0 ? 'auto' : undefined,
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
      // Mistral uses camelCase toolCallId
      return toolResults.map(result => ({
        role: 'tool',
        toolCallId: result.toolCallId,
        content: result.content,
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
