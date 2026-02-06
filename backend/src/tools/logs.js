const MAX_ENTRIES = 200
const MAX_MESSAGE_LENGTH = 2000
const MAX_TIMEFRAME_DAYS = 30

export const definition = {
  name: 'fetch_logs',
  description: 'Retrieve server logs from the connected logging provider',
  input_schema: {
    type: 'object',
    properties: {
      timeframe: { type: 'string', description: "Time range to fetch, e.g. '1h', '24h', '7d'" },
      level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
      search: { type: 'string', description: 'Filter logs containing this text' }
    }
  }
}

function parseTimeframe(timeframe = '1h') {
  const match = timeframe.match(/^(\d+)(m|h|d)$/)
  if (!match) throw new Error(`Invalid timeframe: "${timeframe}". Use format like "1h", "24h", "7d"`)

  const [, amount, unit] = match
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 }
  const durationMs = parseInt(amount) * multipliers[unit]

  if (durationMs <= 0) {
    throw new Error('Timeframe must be greater than zero')
  }

  const maxDurationMs = MAX_TIMEFRAME_DAYS * 86_400_000
  if (durationMs > maxDurationMs) {
    throw new Error(`Timeframe too large. Maximum is ${MAX_TIMEFRAME_DAYS}d`)
  }

  const endDate = Date.now()
  return { startDate: endDate - durationMs, endDate }
}

function validateConfig(config) {
  if (!config.provider) throw new Error('No log provider configured — set it in the Connectors view')
  if (!config.apiKey) throw new Error(`Missing ${config.provider} API key — configure it in the Connectors view`)
  if (!config.projectId) throw new Error(`Missing ${config.provider} project ID — configure it in the Connectors view`)
}

async function fetchVercelLogs(config, params) {
  const { startDate, endDate } = parseTimeframe(params.timeframe)

  const url = new URL('https://api.vercel.com/v3/runtime/logs')
  url.searchParams.set('projectId', config.projectId)
  url.searchParams.set('startDate', startDate.toString())
  url.searchParams.set('endDate', endDate.toString())

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vercel API error (${response.status}): ${body}`)
  }

  return response.json()
}

const providers = {
  vercel: fetchVercelLogs,
}

export async function execute(input, config) {
  validateConfig(config)

  const fetcher = providers[config.provider]
  if (!fetcher) {
    throw new Error(`Unsupported log provider: "${config.provider}". Supported: ${Object.keys(providers).join(', ')}`)
  }

  let entries = await fetcher(config, input)

  // Normalize to array (API may return { logs: [...] } or [...])
  if (!Array.isArray(entries)) {
    entries = entries.logs || entries.data || []
  }

  // Filter by level
  if (input.level) {
    entries = entries.filter(e => e.level === input.level)
  }

  // Filter by search text
  if (input.search) {
    const searchLower = input.search.toLowerCase()
    entries = entries.filter(e =>
      (e.message || '').toLowerCase().includes(searchLower)
    )
  }

  // Sort newest first
  entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Truncate
  const totalCount = entries.length
  entries = entries.slice(0, MAX_ENTRIES)

  // Format for Claude
  const formatted = entries.map(e => {
    let timestamp
    try {
      timestamp = new Date(e.timestamp).toISOString()
    } catch {
      timestamp = null
    }

    return {
      timestamp,
      level: e.level || 'info',
      message: (e.message || '').slice(0, MAX_MESSAGE_LENGTH),
      source: e.source,
      statusCode: e.statusCode,
      requestId: e.requestId,
    }
  })

  return {
    logs: formatted,
    count: formatted.length,
    total: totalCount,
    truncated: totalCount > MAX_ENTRIES,
    provider: config.provider,
  }
}
