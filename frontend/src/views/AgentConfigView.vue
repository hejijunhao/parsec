<template>
  <div class="agent-config-view">
    <h1>Agent Configuration</h1>

    <label>
      Claude API Key
      <input v-model="store.agentConfig.apiKey" type="password" placeholder="sk-ant-..." />
    </label>

    <label>
      Model
      <select v-model="store.agentConfig.model">
        <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
        <option value="claude-opus-4-20250514">Claude Opus</option>
      </select>
    </label>

    <label>
      System Prompt (optional)
      <textarea v-model="store.agentConfig.systemPrompt" placeholder="Custom instructions for the agent..." rows="4"></textarea>
    </label>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
</script>
