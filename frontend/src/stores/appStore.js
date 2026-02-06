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

  function addMessage(role, content) {
    messages.value.push({ role, content })
  }

  function clearMessages() {
    messages.value = []
  }

  return { connectors, agentConfig, messages, addMessage, clearMessages }
})
