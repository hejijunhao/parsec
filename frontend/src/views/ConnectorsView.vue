<template>
  <div class="connectors-view">
    <h1 class="page-header">Connectors</h1>

    <!-- Section 1: Database -->
    <section class="panel">
      <h2 class="panel-title">Database</h2>
      <div class="field">
        <label class="label" for="db-type">Type</label>
        <select id="db-type" v-model="store.connectors.database.type">
          <option value="">Select...</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql" disabled>MySQL (coming soon)</option>
        </select>
      </div>
      <div class="field">
        <label class="label" for="db-conn">Connection String</label>
        <input id="db-conn" v-model="store.connectors.database.connectionString" type="text" placeholder="postgres://user:pass@host:5432/db" />
      </div>
    </section>

    <!-- Section 2: Codebase -->
    <section class="panel">
      <h2 class="panel-title">Codebase</h2>
      <div class="field">
        <label class="label" for="cb-path">Local Path or Git URL</label>
        <input id="cb-path" v-model="store.connectors.codebase.path" type="text" placeholder="/path/to/repo" />
      </div>
    </section>

    <!-- Section 3: Server Logs -->
    <section class="panel">
      <h2 class="panel-title">Server Logs</h2>
      <div class="field">
        <label class="label" for="log-provider">Provider</label>
        <select id="log-provider" v-model="store.connectors.logs.provider">
          <option value="">Select...</option>
          <option value="vercel">Vercel</option>
        </select>
      </div>
      <div class="field">
        <label class="label" for="log-key">API Key</label>
        <input id="log-key" v-model="store.connectors.logs.apiKey" type="password" placeholder="API key" />
      </div>
      <div class="field">
        <label class="label" for="log-project">Project ID</label>
        <input id="log-project" v-model="store.connectors.logs.projectId" type="text" placeholder="Project ID" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
</script>

<style scoped>
.connectors-view {
  max-width: 640px;
}

.panel + .panel {
  margin-top: 24px;
}

.field {
  margin-bottom: 16px;
}

.field:last-child {
  margin-bottom: 0;
}

.field input,
.field select {
  width: 100%;
}
</style>
