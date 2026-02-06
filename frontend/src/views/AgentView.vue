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

    <p class="context-tip">Tip: include full context in each message — the agent does not recall tool data from earlier turns.</p>

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

<style scoped>
.agent-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  padding: 1rem;
}

.messages {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.message {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.message.user {
  background: #f0f0f0;
}

.message.assistant {
  background: #e8f4fd;
}

.message.error {
  background: #fde8e8;
  color: #b91c1c;
}

.tool-calls {
  margin-top: 0.5rem;
  font-size: 0.85em;
}

.tool-input,
.tool-result {
  max-height: 200px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 2px;
  font-size: 0.85em;
}

form {
  display: flex;
  gap: 0.5rem;
}

form input {
  flex: 1;
}

.loading em {
  color: #888;
}

.context-tip {
  font-size: 0.8em;
  color: #888;
  margin: 0 0 0.5rem 0;
}
</style>
