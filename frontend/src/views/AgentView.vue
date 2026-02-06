<template>
  <div class="agent-view">
    <h1>Agent</h1>

    <div class="messages">
      <div v-for="(msg, i) in store.messages" :key="i" :class="['message', msg.role]">
        <strong>{{ msg.role }}:</strong> {{ msg.content }}
      </div>
    </div>

    <form @submit.prevent="send">
      <input v-model="input" type="text" placeholder="Ask the agent..." />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const input = ref('')

async function send() {
  const text = input.value.trim()
  if (!text) return

  store.addMessage('user', text)
  input.value = ''

  // TODO: POST to /api/chat with message, config, and connectors
}
</script>
