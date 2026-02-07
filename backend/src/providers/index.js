import { createAnthropicAdapter } from './anthropic.js'
import { createOpenAIAdapter } from './openai.js'
import { createMistralAdapter } from './mistral.js'
import { createGoogleAdapter } from './google.js'

/**
 * Provider factory registry.
 * Maps provider names to their adapter factory functions.
 */
const adapters = {
  anthropic: createAnthropicAdapter,
  openai: createOpenAIAdapter,
  mistral: createMistralAdapter,
  google: createGoogleAdapter,
}

/**
 * List of providers that have implemented adapters.
 */
export const implementedProviders = Object.keys(adapters)

/**
 * Creates a provider adapter for the given configuration.
 *
 * @param {import('./types.js').ProviderConfig} config
 * @returns {import('./types.js').ProviderAdapter}
 * @throws {Error} If the provider is not supported
 */
export function createProvider(config) {
  const factory = adapters[config.provider]

  if (!factory) {
    const implemented = implementedProviders.join(', ')
    throw new Error(
      `Provider "${config.provider}" is not yet implemented. ` +
      `Currently supported: ${implemented}. ` +
      `OpenAI, Google, and Mistral support coming soon.`
    )
  }

  return factory(config)
}
