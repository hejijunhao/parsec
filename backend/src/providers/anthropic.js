import Anthropic from '@anthropic-ai/sdk'

/**
 * Creates an Anthropic provider adapter.
 * Anthropic's tool format is our canonical format, so minimal translation needed.
 *
 * @param {import('./types.js').ProviderConfig} config
 * @returns {import('./types.js').ProviderAdapter}
 */
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
      // Anthropic uses our canonical format — no translation needed
      return toolDefinitions
    },

    extractToolCalls(response) {
      return response.content
        .filter(block => block.type === 'tool_use')
        .map(block => ({
          id: block.id,
          name: block.name,
          input: block.input,
        }))
    },

    extractText(response) {
      return response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
    },

    requiresToolExecution(response) {
      return response.stop_reason === 'tool_use'
    },

    formatToolResults(toolResults) {
      return toolResults.map(result => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: result.content,
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
