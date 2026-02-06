import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // --- Section 1: Connectors (external source configs) ---
  const connectors = ref({
    database: { type: '', connectionString: '' },
    codebase: { path: '' },
    logs: { provider: '', apiKey: '', projectId: '' },
  })

  // --- Section 2: Agent config ---
  const agentConfig = ref({
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: '',
  })

  // --- Section 3: Chat state ---
  const messages = ref([])
  const loading = ref(false)
  const error = ref(null)

  function addMessage(role, content, toolCalls = null) {
    messages.value.push({ role, content, ...(toolCalls && { toolCalls }) })
  }

  function clearMessages() {
    messages.value = []
  }

  async function sendMessage(text) {
    if (!text.trim()) return
    error.value = null
    addMessage('user', text)
    loading.value = true

    try {
      // Build conversation history for the API
      // Send only role + content (the backend doesn't need toolCalls metadata)
      const history = messages.value
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          config: agentConfig.value,
          connectors: connectors.value,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${response.status})`)
      }

      const data = await response.json()
      addMessage('assistant', data.content, data.toolCalls)
    } catch (err) {
      error.value = err.message
      addMessage('error', err.message)
    } finally {
      loading.value = false
    }
  }

  return { connectors, agentConfig, messages, loading, error, addMessage, clearMessages, sendMessage }
})
