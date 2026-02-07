import { Router } from 'express'
import { createProvider, implementedProviders } from '../providers/index.js'
import { toolDefinitions, executeTool } from '../tools/index.js'

export const chatRouter = Router()

const MAX_ITERATIONS = 10

chatRouter.post('/chat', async (req, res) => {
  const { message, messages: incomingMessages, config, connectors } = req.body

  // Validate required config
  if (!config?.apiKey) {
    return res.status(400).json({ error: 'Missing API key — configure it in Agent Config' })
  }
  if (!config.model) {
    return res.status(400).json({ error: 'Missing model selection — configure it in Agent Config' })
  }
  if (!message && !incomingMessages?.length) {
    return res.status(400).json({ error: 'No message provided' })
  }
  if (!connectors || typeof connectors !== 'object') {
    return res.status(400).json({ error: 'Missing connector configuration — set up at least one source in Connectors' })
  }

  // Default to anthropic if no provider specified
  const providerName = config.provider || 'anthropic'

  try {
    // Create provider adapter (throws if provider not implemented)
    const provider = createProvider({ ...config, provider: providerName })

    // Translate tool definitions to provider's format
    const tools = provider.translateTools(toolDefinitions)

    // Support both single message and conversation history
    let messages = incomingMessages || [{ role: 'user', content: message }]

    const toolCalls = []
    let response
    let iterations = 0

    // Provider-agnostic agentic loop
    while (iterations < MAX_ITERATIONS) {
      iterations++

      response = await provider.chat(messages, tools, config.systemPrompt)

      // If the model didn't request any tools, we're done
      if (!provider.requiresToolExecution(response)) break

      // Execute each tool the model requested
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
        toolResults.push({
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(result),
        })
      }

      // Append assistant response + tool results to messages for next iteration
      messages = provider.appendToConversation(messages, response, toolResults)
    }

    // Extract final text from the last response
    const finalText = provider.extractText(response)

    res.json({
      content: finalText,
      toolCalls,
    })
  } catch (err) {
    // Check if it's a provider-not-implemented error
    if (err.message.includes('not yet implemented')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: err.message })
  }
})
