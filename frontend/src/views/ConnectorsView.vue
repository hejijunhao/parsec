<template>
  <div class="connectors-view">
    <h1>Connectors</h1>

    <!-- Section 1: Database -->
    <section>
      <h2>Database</h2>
      <label>
        Type
        <select v-model="store.connectors.database.type">
          <option value="">Select...</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql" disabled>MySQL (coming soon)</option>
        </select>
      </label>
      <label>
        Connection String
        <input v-model="store.connectors.database.connectionString" type="text" placeholder="postgres://user:pass@host:5432/db" />
      </label>
    </section>

    <!-- Section 2: Codebase -->
    <section>
      <h2>Codebase</h2>
      <label>
        Local Path or Git URL
        <input v-model="store.connectors.codebase.path" type="text" placeholder="/path/to/repo" />
      </label>
    </section>

    <!-- Section 3: Server Logs -->
    <section>
      <h2>Server Logs</h2>
      <label>
        Provider
        <select v-model="store.connectors.logs.provider">
          <option value="">Select...</option>
          <option value="vercel">Vercel</option>
        </select>
      </label>
      <label>
        API Key
        <input v-model="store.connectors.logs.apiKey" type="password" placeholder="API key" />
      </label>
      <label>
        Project ID
        <input v-model="store.connectors.logs.projectId" type="text" placeholder="Project ID" />
      </label>
    </section>
  </div>
</template>

<script setup>
import { useAppStore } from '../stores/appStore.js'

const store = useAppStore()
</script>
