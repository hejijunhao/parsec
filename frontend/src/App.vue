<template>
  <div id="app">
    <nav>
      <router-link to="/connectors">Connectors</router-link>
      <router-link to="/config">Agent Config</router-link>
      <router-link to="/agent">Agent</router-link>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>
