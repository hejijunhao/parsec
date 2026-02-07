#!/usr/bin/env node
/**
 * Provider Test Script
 *
 * Tests each provider adapter with a simple request.
 * Useful for validating SDK compatibility and API key configuration.
 *
 * Usage:
 *   node scripts/test-providers.js <provider> <api-key> [model]
 *
 * Examples:
 *   node scripts/test-providers.js anthropic sk-ant-xxx claude-sonnet-4-20250514
 *   node scripts/test-providers.js openai sk-xxx gpt-4.1
 *   node scripts/test-providers.js google AIza... gemini-2.5-flash
 *   node scripts/test-providers.js mistral xxx mistral-large-latest
 */

import { createProvider, implementedProviders } from '../src/providers/index.js'

const [,, provider, apiKey, model] = process.argv

// Default models per provider
const defaultModels = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4.1',
  google: 'gemini-2.5-flash',
  mistral: 'mistral-large-latest',
}

if (!provider || !apiKey) {
  console.log('Provider Test Script')
  console.log('====================\n')
  console.log('Usage: node scripts/test-providers.js <provider> <api-key> [model]\n')
  console.log('Implemented providers:', implementedProviders.join(', '))
  console.log('\nExamples:')
  console.log('  node scripts/test-providers.js anthropic sk-ant-xxx')
  console.log('  node scripts/test-providers.js openai sk-xxx gpt-4.1')
  process.exit(1)
}

if (!implementedProviders.includes(provider)) {
  console.error(`Error: Provider "${provider}" is not implemented.`)
  console.error('Available providers:', implementedProviders.join(', '))
  process.exit(1)
}

async function testProvider() {
  const config = {
    provider,
    apiKey,
    model: model || defaultModels[provider],
  }

  console.log(`\nTesting ${provider} with model ${config.model}...`)
  console.log('─'.repeat(50))

  try {
    const adapter = createProvider(config)

    // Simple test message
    const messages = [
      { role: 'user', content: 'Say "Hello from Parsec!" and nothing else.' }
    ]

    // No tools for this basic test
    const tools = []

    console.log('Sending request...')
    const response = await adapter.chat(messages, tools, null)

    // Extract text
    const text = adapter.extractText(response)
    console.log('\nResponse:', text)

    // Check for tool calls (should be none)
    const toolCalls = adapter.extractToolCalls(response)
    if (toolCalls.length > 0) {
      console.log('Tool calls:', toolCalls)
    }

    console.log('\n✓ Provider test passed!')
  } catch (err) {
    console.error('\n✗ Provider test failed!')
    console.error('Error:', err.message)
    process.exit(1)
  }
}

testProvider()
