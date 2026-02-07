import { Router } from 'express'
import { createClaudeClient } from '../claude/client.js'
import { toolDefinitions, executeTool } from '../tools/index.js'

export const chatRouter = Router()

const MAX_ITERATIONS = 10

// Supported providers (only Anthropic is implemented for MVP)
const SUPPORTED_PROVIDERS = ['anthropic']

chatRouter.post('/chat', async (req, res) => {
  const { message, messages: incomingMessages, config, connectors } = req.body

  // Validate provider
  const provider = config?.provider || 'anthropic'
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return res.status(400).json({
      error: `Provider "${provider}" is not yet implemented. Currently supported: ${SUPPORTED_PROVIDERS.join(', ')}. OpenAI, Google, and Mistral support coming soon.`
    })
  }

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

  try {
    const client = createClaudeClient(config)

    // Support both single message and conversation history
    let messages = incomingMessages || [{ role: 'user', content: message }]

    const toolCalls = []
    let response
    let iterations = 0

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
