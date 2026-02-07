/**
 * Provider Abstraction Types
 *
 * JSDoc type definitions for the unified provider interface.
 * All provider adapters must implement the ProviderAdapter interface.
 */

/**
 * A single tool invocation requested by the model.
 * @typedef {Object} ToolCall
 * @property {string} id - Unique identifier for this tool invocation
 * @property {string} name - Tool name (e.g., 'query_database')
 * @property {Object} input - Tool input arguments
 */

/**
 * Result of a tool execution to be sent back to the model.
 * @typedef {Object} ToolResult
 * @property {string} toolCallId - ID of the tool call this result is for
 * @property {string} name - Tool name (needed by some providers like Gemini)
 * @property {string} content - JSON-stringified result
 */

/**
 * Unified provider adapter interface.
 * Each provider (Anthropic, OpenAI, Google, Mistral) implements this interface.
 *
 * @typedef {Object} ProviderAdapter
 * @property {function(Message[], any[], string?): Promise<any>} chat
 *   Send messages to the model with optional tools and system prompt.
 *   Returns the raw provider response.
 *
 * @property {function(ToolDefinition[]): any[]} translateTools
 *   Convert our canonical tool definitions to the provider's format.
 *
 * @property {function(any): ToolCall[]} extractToolCalls
 *   Extract tool call requests from the provider's response.
 *
 * @property {function(any): string} extractText
 *   Extract text content from the provider's response.
 *
 * @property {function(any): boolean} requiresToolExecution
 *   Check if the response indicates the model wants to use tools.
 *
 * @property {function(ToolResult[]): any[]} formatToolResults
 *   Format tool results for the provider's expected structure.
 *
 * @property {function(Message[], any, ToolResult[]): Message[]} appendToConversation
 *   Append the assistant response and tool results to the conversation.
 */

/**
 * Canonical tool definition format (Anthropic-style).
 * @typedef {Object} ToolDefinition
 * @property {string} name - Tool name
 * @property {string} description - Human-readable description
 * @property {Object} input_schema - JSON Schema for the input parameters
 */

/**
 * Provider configuration passed from the frontend.
 * @typedef {Object} ProviderConfig
 * @property {string} provider - Provider name ('anthropic', 'openai', 'google', 'mistral')
 * @property {string} apiKey - API key for the provider
 * @property {string} model - Model identifier
 * @property {string} [systemPrompt] - Optional system prompt
 */

export default {}
