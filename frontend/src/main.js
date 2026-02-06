import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ConnectorsView from './views/ConnectorsView.vue'
import AgentConfigView from './views/AgentConfigView.vue'
import AgentView from './views/AgentView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/connectors' },
    { path: '/connectors', component: ConnectorsView },
    { path: '/config', component: AgentConfigView },
    { path: '/agent', component: AgentView },
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
