import { definition as databaseDef, execute as executeDatabase } from './database.js'
import { definition as codebaseDef, execute as executeCodebase } from './codebase.js'
import { definition as logsDef, execute as executeLogs } from './logs.js'

export const toolDefinitions = [databaseDef, codebaseDef, logsDef]

const executors = {
  query_database: executeDatabase,
  search_codebase: executeCodebase,
  fetch_logs: executeLogs,
}

export async function executeTool(name, input, connectors) {
  const executor = executors[name]
  if (!executor) throw new Error(`Unknown tool: ${name}`)

  const configMap = {
    query_database: connectors.database,
    search_codebase: connectors.codebase,
    fetch_logs: connectors.logs,
  }

  return executor(input, configMap[name])
}
