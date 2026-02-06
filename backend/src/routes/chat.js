import { Router } from 'express'
import { createClaudeClient } from '../claude/client.js'
import { toolDefinitions, executeTool } from '../tools/index.js'

export const chatRouter = Router()

chatRouter.post('/chat', async (req, res) => {
  const { message, config, connectors } = req.body

  try {
    const client = createClaudeClient(config)

    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: config.systemPrompt || undefined,
      tools: toolDefinitions,
      messages: [{ role: 'user', content: message }],
    })

    // Handle tool use in the response
    const toolResults = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input, connectors)
        toolResults.push({ tool: block.name, result })
      }
    }

    res.json({
      content: response.content,
      toolResults,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
