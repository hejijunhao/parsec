import { definition as databaseDef, execute as executeDatabase } from './database.js'
import { definition as codebaseDef, execute as executeCodebase } from './codebase.js'
import { definition as logsDef, execute as executeLogs } from './logs.js'

export const toolDefinitions = [databaseDef, codebaseDef, logsDef]

const executors = {
  query_database: executeDatabase,
  search_codebase: executeCodebase,
  fetch_logs: executeLogs,
}

/**
 * Translate the multi-provider logs config into single-provider format.
 * Returns the first enabled provider's config, or null if none enabled.
 */
function resolveLogsConfig(logs) {
  if (!logs || typeof logs !== 'object') return null

  // Find the first enabled provider
  for (const [providerName, providerConfig] of Object.entries(logs)) {
    if (providerConfig?.enabled) {
      return {
        provider: providerName,
        ...providerConfig,
      }
    }
  }
  return null
}

/**
 * Translate the new codebase config { source, url } to the format the tool expects.
 * Currently only github-url is supported, and it passes the URL as the path.
 */
function resolveCodebaseConfig(codebase) {
  if (!codebase || !codebase.source) return null

  if (codebase.source === 'github-url') {
    return { source: 'github-url', url: codebase.url }
  }

  // Other sources (github-token, trajan) are not yet implemented
  return null
}

export async function executeTool(name, input, connectors) {
  const executor = executors[name]
  if (!executor) throw new Error(`Unknown tool: ${name}`)

  const configMap = {
    query_database: connectors.database,
    search_codebase: resolveCodebaseConfig(connectors.codebase),
    fetch_logs: resolveLogsConfig(connectors.logs),
  }

  return executor(input, configMap[name])
}
