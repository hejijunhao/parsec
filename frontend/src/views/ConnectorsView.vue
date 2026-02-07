<template>
  <div class="connectors-view">
    <h1 class="page-header">Connectors</h1>

    <!-- Section 1: Database -->
    <section class="panel">
      <h2 class="panel-title">Database</h2>
      <div class="selector-group">
        <button
          class="selector-btn"
          :class="{ active: store.connectors.database.type === 'postgresql' }"
          @click="store.connectors.database.type = 'postgresql'"
        >
          <span class="selector-icon">🐘</span>
          <span class="selector-label">PostgreSQL</span>
        </button>
        <button class="selector-btn disabled" disabled>
          <span class="selector-icon">🐬</span>
          <span class="selector-label">MySQL</span>
          <span class="coming-soon">Coming soon</span>
        </button>
      </div>
      <div v-if="store.connectors.database.type === 'postgresql'" class="config-fields">
        <div class="field">
          <label class="label" for="db-conn">Connection String</label>
          <input
            id="db-conn"
            v-model="store.connectors.database.connectionString"
            type="text"
            placeholder="postgres://user:pass@host:5432/db"
          />
        </div>
      </div>
    </section>

    <!-- Section 2: Codebase -->
    <section class="panel">
      <h2 class="panel-title">Codebase</h2>
      <div class="selector-group">
        <button
          class="selector-btn"
          :class="{ active: store.connectors.codebase.source === 'github-url' }"
          @click="store.connectors.codebase.source = 'github-url'"
        >
          <span class="selector-icon">🔗</span>
          <span class="selector-label">GitHub URL</span>
          <span class="selector-hint">Public repos</span>
        </button>
        <button class="selector-btn disabled" disabled>
          <span class="selector-icon">🔑</span>
          <span class="selector-label">GitHub Token</span>
          <span class="coming-soon">Coming soon</span>
        </button>
        <button class="selector-btn disabled" disabled>
          <span class="selector-icon">🏛️</span>
          <span class="selector-label">Trajan</span>
          <span class="coming-soon">Coming soon</span>
        </button>
      </div>
      <div v-if="store.connectors.codebase.source === 'github-url'" class="config-fields">
        <div class="field">
          <label class="label" for="cb-url">Repository URL</label>
          <input
            id="cb-url"
            v-model="store.connectors.codebase.url"
            type="text"
            placeholder="https://github.com/owner/repo"
          />
        </div>
      </div>
    </section>

    <!-- Section 3: Server Logs -->
    <section class="panel">
      <h2 class="panel-title">Server Logs</h2>
      <p class="section-hint">Click to configure each provider. Leave unconfigured to skip.</p>

      <div class="provider-grid">
        <!-- Vercel -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'vercel', configured: store.connectors.logs.vercel.enabled }"
          @click="toggleProvider('vercel')"
        >
          <div class="provider-header">
            <span class="provider-icon">▲</span>
            <span class="provider-name">Vercel</span>
            <span v-if="store.connectors.logs.vercel.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'vercel'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">API Key</label>
              <input v-model="store.connectors.logs.vercel.apiKey" type="password" placeholder="API key" />
            </div>
            <div class="field">
              <label class="label">Project ID</label>
              <input v-model="store.connectors.logs.vercel.projectId" type="text" placeholder="prj_..." />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('vercel')">
                {{ store.connectors.logs.vercel.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.vercel.enabled" class="btn-disable" @click="disableProvider('vercel')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Fly.io -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'flyio', configured: store.connectors.logs.flyio.enabled }"
          @click="toggleProvider('flyio')"
        >
          <div class="provider-header">
            <span class="provider-icon">🪁</span>
            <span class="provider-name">Fly.io</span>
            <span v-if="store.connectors.logs.flyio.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'flyio'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">API Token</label>
              <input v-model="store.connectors.logs.flyio.apiKey" type="password" placeholder="API token" />
            </div>
            <div class="field">
              <label class="label">App Name</label>
              <input v-model="store.connectors.logs.flyio.appName" type="text" placeholder="my-app" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('flyio')">
                {{ store.connectors.logs.flyio.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.flyio.enabled" class="btn-disable" @click="disableProvider('flyio')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Grafana -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'grafana', configured: store.connectors.logs.grafana.enabled }"
          @click="toggleProvider('grafana')"
        >
          <div class="provider-header">
            <span class="provider-icon">📊</span>
            <span class="provider-name">Grafana</span>
            <span v-if="store.connectors.logs.grafana.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'grafana'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Grafana URL</label>
              <input v-model="store.connectors.logs.grafana.url" type="text" placeholder="https://grafana.example.com" />
            </div>
            <div class="field">
              <label class="label">API Key</label>
              <input v-model="store.connectors.logs.grafana.apiKey" type="password" placeholder="API key" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('grafana')">
                {{ store.connectors.logs.grafana.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.grafana.enabled" class="btn-disable" @click="disableProvider('grafana')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- AWS CloudWatch -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'aws', configured: store.connectors.logs.aws.enabled }"
          @click="toggleProvider('aws')"
        >
          <div class="provider-header">
            <span class="provider-icon">☁️</span>
            <span class="provider-name">AWS CloudWatch</span>
            <span v-if="store.connectors.logs.aws.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'aws'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Access Key ID</label>
              <input v-model="store.connectors.logs.aws.accessKeyId" type="text" placeholder="AKIA..." />
            </div>
            <div class="field">
              <label class="label">Secret Access Key</label>
              <input v-model="store.connectors.logs.aws.secretAccessKey" type="password" placeholder="Secret key" />
            </div>
            <div class="field">
              <label class="label">Region</label>
              <input v-model="store.connectors.logs.aws.region" type="text" placeholder="us-east-1" />
            </div>
            <div class="field">
              <label class="label">Log Group</label>
              <input v-model="store.connectors.logs.aws.logGroup" type="text" placeholder="/aws/lambda/my-function" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('aws')">
                {{ store.connectors.logs.aws.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.aws.enabled" class="btn-disable" @click="disableProvider('aws')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Azure Monitor -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'azure', configured: store.connectors.logs.azure.enabled }"
          @click="toggleProvider('azure')"
        >
          <div class="provider-header">
            <span class="provider-icon">🔷</span>
            <span class="provider-name">Azure Monitor</span>
            <span v-if="store.connectors.logs.azure.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'azure'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Workspace ID</label>
              <input v-model="store.connectors.logs.azure.workspaceId" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </div>
            <div class="field">
              <label class="label">Shared Key</label>
              <input v-model="store.connectors.logs.azure.sharedKey" type="password" placeholder="Primary or secondary key" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('azure')">
                {{ store.connectors.logs.azure.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.azure.enabled" class="btn-disable" @click="disableProvider('azure')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Google Cloud -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'gcp', configured: store.connectors.logs.gcp.enabled }"
          @click="toggleProvider('gcp')"
        >
          <div class="provider-header">
            <span class="provider-icon">🌐</span>
            <span class="provider-name">Google Cloud</span>
            <span v-if="store.connectors.logs.gcp.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'gcp'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Project ID</label>
              <input v-model="store.connectors.logs.gcp.projectId" type="text" placeholder="my-project-123" />
            </div>
            <div class="field">
              <label class="label">Service Account JSON</label>
              <textarea v-model="store.connectors.logs.gcp.credentials" rows="3" placeholder='{"type": "service_account", ...}'></textarea>
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('gcp')">
                {{ store.connectors.logs.gcp.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.gcp.enabled" class="btn-disable" @click="disableProvider('gcp')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Redis -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'redis', configured: store.connectors.logs.redis.enabled }"
          @click="toggleProvider('redis')"
        >
          <div class="provider-header">
            <span class="provider-icon">🔴</span>
            <span class="provider-name">Redis</span>
            <span v-if="store.connectors.logs.redis.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'redis'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Connection String</label>
              <input v-model="store.connectors.logs.redis.connectionString" type="text" placeholder="redis://user:pass@host:6379" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('redis')">
                {{ store.connectors.logs.redis.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.redis.enabled" class="btn-disable" @click="disableProvider('redis')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Datadog -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'datadog', configured: store.connectors.logs.datadog.enabled }"
          @click="toggleProvider('datadog')"
        >
          <div class="provider-header">
            <span class="provider-icon">🐕</span>
            <span class="provider-name">Datadog</span>
            <span v-if="store.connectors.logs.datadog.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'datadog'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">API Key</label>
              <input v-model="store.connectors.logs.datadog.apiKey" type="password" placeholder="API key" />
            </div>
            <div class="field">
              <label class="label">Application Key</label>
              <input v-model="store.connectors.logs.datadog.appKey" type="password" placeholder="App key" />
            </div>
            <div class="field">
              <label class="label">Site</label>
              <input v-model="store.connectors.logs.datadog.site" type="text" placeholder="datadoghq.com" />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('datadog')">
                {{ store.connectors.logs.datadog.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.datadog.enabled" class="btn-disable" @click="disableProvider('datadog')">
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Supabase -->
        <div
          class="provider-card"
          :class="{ expanded: expandedProvider === 'supabase', configured: store.connectors.logs.supabase.enabled }"
          @click="toggleProvider('supabase')"
        >
          <div class="provider-header">
            <span class="provider-icon">⚡</span>
            <span class="provider-name">Supabase</span>
            <span v-if="store.connectors.logs.supabase.enabled" class="configured-badge">✓</span>
          </div>
          <div v-if="expandedProvider === 'supabase'" class="provider-config" @click.stop>
            <div class="field">
              <label class="label">Project Ref</label>
              <input v-model="store.connectors.logs.supabase.projectRef" type="text" placeholder="abcdefghijklmnop" />
            </div>
            <div class="field">
              <label class="label">Service Role Key</label>
              <input v-model="store.connectors.logs.supabase.apiKey" type="password" placeholder="eyJhbG..." />
            </div>
            <div class="provider-actions">
              <button class="btn-enable" @click="enableProvider('supabase')">
                {{ store.connectors.logs.supabase.enabled ? 'Update' : 'Enable' }}
              </button>
              <button v-if="store.connectors.logs.supabase.enabled" class="btn-disable" @click="disableProvider('supabase')">
                Disable
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
const expandedProvider = ref(null)

function toggleProvider(provider) {
  expandedProvider.value = expandedProvider.value === provider ? null : provider
}

function enableProvider(provider) {
  store.connectors.logs[provider].enabled = true
  expandedProvider.value = null
}

function disableProvider(provider) {
  store.connectors.logs[provider].enabled = false
}
</script>

<style scoped>
.connectors-view {
  max-width: 720px;
}

.panel + .panel {
  margin-top: 24px;
}

/* Selector buttons (Database & Codebase) */
.selector-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.selector-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  min-width: 120px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.selector-btn:hover:not(.disabled) {
  border-color: var(--border-active);
  background: var(--bg-hover);
}

.selector-btn.active {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.selector-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selector-icon {
  font-size: 24px;
}

.selector-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.selector-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.coming-soon {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  background: var(--bg-base);
  padding: 2px 6px;
  border-radius: 2px;
}

/* Config fields that appear after selection */
.config-fields {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
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

/* Server logs section */
.section-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.provider-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.provider-card:hover:not(.expanded) {
  border-color: var(--border-active);
  background: var(--bg-hover);
}

.provider-card.expanded {
  grid-column: 1 / -1;
  border-color: var(--accent);
}

.provider-card.configured:not(.expanded) {
  border-color: var(--success);
  background: rgba(52, 211, 153, 0.05);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.provider-icon {
  font-size: 18px;
}

.provider-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.configured-badge {
  font-size: 12px;
  color: var(--success);
  font-weight: 600;
}

.provider-config {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border);
  margin-top: 0;
  padding-top: 16px;
}

.provider-config .field {
  margin-bottom: 12px;
}

.provider-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn-enable {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--bg-base);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 2px;
}

.btn-enable:hover {
  opacity: 0.9;
}

.btn-disable {
  padding: 8px 16px;
  background: transparent;
  color: var(--error);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid var(--error);
  border-radius: 2px;
}

.btn-disable:hover {
  background: rgba(255, 77, 106, 0.1);
}
</style>
