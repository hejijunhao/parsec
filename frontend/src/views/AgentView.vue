<template>
  <div class="agent-view">
    <div class="messages" ref="messagesContainer">
      <div v-for="(msg, i) in store.messages" :key="i" :class="['message', msg.role]">
        <!-- User message -->
        <template v-if="msg.role === 'user'">
          <span class="msg-label">YOU</span>
          <div class="msg-body">{{ msg.content }}</div>
        </template>

        <!-- Assistant message -->
        <template v-else-if="msg.role === 'assistant'">
          <span class="msg-label">AGENT</span>
          <div class="msg-body">{{ msg.content }}</div>

          <!-- Tool calls (if any) -->
          <details v-if="msg.toolCalls && msg.toolCalls.length" class="tool-calls">
            <summary class="tool-summary">
              <span class="tool-toggle">+</span>
              {{ msg.toolCalls.length }} tool{{ msg.toolCalls.length > 1 ? 's' : '' }} used
            </summary>
            <div v-for="(tc, j) in msg.toolCalls" :key="j" class="tool-call">
              <span class="tool-name">{{ tc.tool }}</span>
              <pre class="tool-data">{{ JSON.stringify(tc.input, null, 2) }}</pre>
              <pre class="tool-data tool-result">{{ JSON.stringify(tc.result, null, 2) }}</pre>
            </div>
          </details>
        </template>

        <!-- Error message -->
        <template v-else-if="msg.role === 'error'">
          <span class="msg-label error-label">ERROR</span>
          <div class="msg-body">{{ msg.content }}</div>
        </template>
      </div>

      <!-- Loading indicator -->
      <div v-if="store.loading" class="message assistant">
        <span class="msg-label">AGENT</span>
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <p class="context-tip">Full context is sent with each message — the agent does not recall tool data from earlier turns.</p>

    <form @submit.prevent="send" class="input-bar">
      <input
        v-model="input"
        type="text"
        placeholder="Ask the agent..."
        :disabled="store.loading"
      />
      <button type="submit" :disabled="store.loading || !input.trim()">
        SEND
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
  max-height: calc(100vh - 48px - 64px); /* topbar + main padding */
}

/* ── Messages area ── */

.messages {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-surface);
  padding: 24px;
}

.message {
  margin-bottom: 20px;
}

.message:last-child {
  margin-bottom: 0;
}

/* ── Message labels ── */

.msg-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.error-label {
  color: var(--error);
}

/* ── Message bodies ── */

.msg-body {
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* User messages — right-aligned, elevated background */
.message.user {
  margin-left: 20%;
  background: var(--bg-elevated);
  padding: 16px;
  border-radius: 2px 0 0 0;
}

/* Assistant messages — left border accent */
.message.assistant {
  border-left: 2px solid var(--border-active);
  padding-left: 16px;
}

/* Error messages — left border error */
.message.error {
  border-left: 2px solid var(--error);
  padding-left: 16px;
}

.message.error .msg-body {
  color: var(--error);
}

/* ── Tool calls ── */

.tool-calls {
  margin-top: 12px;
}

.tool-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.tool-summary::-webkit-details-marker {
  display: none;
}

.tool-toggle {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-muted);
  width: 16px;
  text-align: center;
}

details[open] .tool-toggle {
  transform: none;
}

details[open] .tool-toggle::after {
  content: '';
}

details:not([open]) .tool-toggle::after {
  content: '';
}

.tool-call {
  margin-top: 12px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  padding: 12px;
}

.tool-name {
  display: block;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.tool-data {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.tool-result {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

/* ── Loading dots ── */

.loading-dots {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-primary);
  animation: dot-pulse 1.2s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes dot-pulse {
  0%, 60%, 100% { opacity: 0.15; }
  30% { opacity: 0.8; }
}

/* ── Context tip ── */

.context-tip {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 0;
}

/* ── Input bar ── */

.input-bar {
  display: flex;
  gap: 0;
}

.input-bar input {
  flex: 1;
  border-radius: 2px 0 0 2px;
  border: 1px solid transparent;
  background: var(--bg-elevated);
  padding: 12px 16px;
}

.input-bar input:focus {
  border-color: var(--accent);
  outline: none;
}

.input-bar button {
  background: var(--accent);
  color: var(--bg-base);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  border-radius: 0 2px 2px 0;
}

.input-bar button:hover:not(:disabled) {
  opacity: 0.9;
}

.input-bar button:disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>
