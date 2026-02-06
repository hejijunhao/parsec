import Anthropic from '@anthropic-ai/sdk'

export function createClaudeClient(config) {
  return new Anthropic({ apiKey: config.apiKey })
}
