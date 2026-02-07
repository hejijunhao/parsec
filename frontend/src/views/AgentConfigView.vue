<template>
  <div class="config-view">
    <h1 class="page-header">Agent Configuration</h1>

    <section class="panel">
      <!-- Provider Selection -->
      <div class="field">
        <label class="label">Provider</label>
        <div class="provider-tabs">
          <button
            v-for="provider in providers"
            :key="provider.id"
            class="provider-tab"
            :class="{ active: store.agentConfig.provider === provider.id }"
            @click="selectProvider(provider.id)"
          >
            {{ provider.name }}
          </button>
        </div>
      </div>

      <!-- API Key -->
      <div class="field">
        <label class="label" :for="'api-key'">{{ currentProvider.keyLabel }}</label>
        <input
          id="api-key"
          v-model="store.agentConfig.apiKey"
          type="password"
          class="mono-input"
          :placeholder="currentProvider.keyPlaceholder"
        />
        <p class="hint">Key is sent per-request and never stored.</p>
      </div>

      <!-- Model Selection -->
      <div class="field">
        <label class="label" for="model">Model</label>
        <div class="model-grid">
          <button
            v-for="model in currentModels"
            :key="model.id"
            class="model-card"
            :class="{ active: store.agentConfig.model === model.id }"
            @click="store.agentConfig.model = model.id"
          >
            <span class="model-name">{{ model.name }}</span>
            <span class="model-desc">{{ model.description }}</span>
            <span v-if="model.tag" class="model-tag" :class="model.tag">{{ model.tag }}</span>
          </button>
        </div>
      </div>

      <!-- System Prompt -->
      <div class="field">
        <label class="label" for="sys-prompt">System Prompt (optional)</label>
        <textarea
          id="sys-prompt"
          v-model="store.agentConfig.systemPrompt"
          class="mono-input"
          placeholder="Custom instructions for the agent..."
          rows="6"
        ></textarea>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()

// Provider definitions
const providers = [
  { id: 'anthropic', name: 'Anthropic', keyLabel: 'API Key', keyPlaceholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', keyLabel: 'API Key', keyPlaceholder: 'sk-...' },
  { id: 'google', name: 'Google', keyLabel: 'API Key', keyPlaceholder: 'AIza...' },
  { id: 'mistral', name: 'Mistral', keyLabel: 'API Key', keyPlaceholder: '' },
]

// Model definitions per provider
const modelsByProvider = {
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Opus 4.6', description: 'Most intelligent — complex reasoning & coding', tag: 'latest' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', description: 'Best speed/intelligence balance', tag: 'recommended' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', description: 'Fastest — high-volume tasks' },
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5', description: 'Previous flagship model' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', description: 'Reliable general-purpose' },
  ],
  openai: [
    { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', description: 'Best for coding — 1M context', tag: 'latest' },
    { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini', description: 'Faster, lower cost', tag: 'recommended' },
    { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano', description: 'Fastest, most affordable' },
    { id: 'gpt-4o-2024-11-20', name: 'GPT-4o', description: 'Multimodal — text & vision' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster multimodal' },
  ],
  google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Complex reasoning & STEM', tag: 'recommended' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best cost-performance balance' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Fastest, high throughput' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Newest multimodal preview', tag: 'preview' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Newest balanced preview', tag: 'preview' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Top-tier for complex tasks', tag: 'latest' },
    { id: 'magistral-medium-latest', name: 'Magistral Medium', description: 'Reasoning specialist', tag: 'recommended' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced performance' },
    { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast and efficient' },
  ],
}

// Default models per provider
const defaultModels = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4.1-mini-2025-04-14',
  google: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
}

const currentProvider = computed(() => {
  return providers.find(p => p.id === store.agentConfig.provider) || providers[0]
})

const currentModels = computed(() => {
  return modelsByProvider[store.agentConfig.provider] || []
})

function selectProvider(providerId) {
  store.agentConfig.provider = providerId
  // Set default model for the new provider
  store.agentConfig.model = defaultModels[providerId]
}
</script>

<style scoped>
.config-view {
  max-width: 720px;
}

.field {
  margin-bottom: 20px;
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

/* Provider tabs */
.provider-tabs {
  display: flex;
  gap: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.provider-tab {
  flex: 1;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  cursor: pointer;
  transition: all 150ms ease-out;
}

.provider-tab:last-child {
  border-right: none;
}

.provider-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.provider-tab.active {
  color: var(--bg-base);
  background: var(--accent);
}

/* Model grid */
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.model-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: all 150ms ease-out;
}

.model-card:hover {
  border-color: var(--border-active);
  background: var(--bg-hover);
}

.model-card.active {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.model-tag {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 2px;
  margin-top: 4px;
}

.model-tag.latest {
  color: var(--success);
  background: rgba(52, 211, 153, 0.15);
}

.model-tag.recommended {
  color: var(--accent);
  background: var(--accent-dim);
}

.model-tag.preview {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
}
</style>
