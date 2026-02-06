<template>
  <div class="config-view">
    <h1 class="page-header">Agent Configuration</h1>

    <section class="panel">
      <div class="field">
        <label class="label" for="api-key">Claude API Key</label>
        <input id="api-key" v-model="store.agentConfig.apiKey" type="password" class="mono-input" placeholder="sk-ant-..." />
        <p class="hint">Key is sent per-request and never stored.</p>
      </div>

      <div class="field">
        <label class="label" for="model">Model</label>
        <select id="model" v-model="store.agentConfig.model">
          <option value="claude-sonnet-4-20250514">SONNET 4</option>
          <option value="claude-opus-4-20250514">OPUS 4</option>
        </select>
      </div>

      <div class="field">
        <label class="label" for="sys-prompt">System Prompt (optional)</label>
        <textarea id="sys-prompt" v-model="store.agentConfig.systemPrompt" class="mono-input" placeholder="Custom instructions for the agent..." rows="6"></textarea>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
</script>

<style scoped>
.config-view {
  max-width: 640px;
}

.field {
  margin-bottom: 16px;
}

.field:last-child {
  margin-bottom: 0;
}

.field input,
.field select,
.field textarea {
  width: 100%;
}

.mono-input {
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}
</style>
