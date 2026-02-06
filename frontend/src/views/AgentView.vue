<template>
  <div class="agent-view">
    <h1>Agent</h1>

    <div class="messages" ref="messagesContainer">
      <div v-for="(msg, i) in store.messages" :key="i" :class="['message', msg.role]">
        <!-- User message -->
        <template v-if="msg.role === 'user'">
          <strong>You:</strong> {{ msg.content }}
        </template>

        <!-- Assistant message -->
        <template v-else-if="msg.role === 'assistant'">
          <strong>Agent:</strong>
          <div class="assistant-content">{{ msg.content }}</div>

          <!-- Tool calls (if any) -->
          <details v-if="msg.toolCalls && msg.toolCalls.length" class="tool-calls">
            <summary>Tools used ({{ msg.toolCalls.length }})</summary>
            <div v-for="(tc, j) in msg.toolCalls" :key="j" class="tool-call">
              <strong>{{ tc.tool }}</strong>
              <pre class="tool-input">{{ JSON.stringify(tc.input, null, 2) }}</pre>
              <pre class="tool-result">{{ JSON.stringify(tc.result, null, 2) }}</pre>
            </div>
          </details>
        </template>

        <!-- Error message -->
        <template v-else-if="msg.role === 'error'">
          <strong>Error:</strong> {{ msg.content }}
        </template>
      </div>

      <!-- Loading indicator -->
      <div v-if="store.loading" class="message assistant loading">
        <em>Thinking...</em>
      </div>
    </div>

    <form @submit.prevent="send">
      <input
        v-model="input"
        type="text"
        placeholder="Ask the agent..."
        :disabled="store.loading"
      />
      <button type="submit" :disabled="store.loading || !input.trim()">
        {{ store.loading ? 'Sending...' : 'Send' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const input = ref('')
const messagesContainer = ref(null)

async function send() {
  const text = input.value.trim()
  if (!text || store.loading) return

  input.value = ''
  await store.sendMessage(text)
}

// Auto-scroll to bottom when messages change
watch(
  () => store.messages.length,
  async () => {
    await nextTick()
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
)
</script>
