<template>
  <div id="app">
    <header class="topbar">
      <span class="wordmark">PARSEC</span>
      <nav>
        <router-link to="/connectors">Connectors</router-link>
        <router-link to="/config">Config</router-link>
        <router-link to="/agent">Agent</router-link>
      </nav>
    </header>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 24px;
  height: 48px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.wordmark {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  user-select: none;
}

nav {
  display: flex;
  gap: 0;
  height: 100%;
}

nav a {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 100%;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: color 150ms ease-out, background 150ms ease-out, border-color 150ms ease-out;
}

nav a:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

nav a.router-link-active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--accent-dim);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}
</style>
