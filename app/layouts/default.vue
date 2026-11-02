<script setup lang="ts">
import AppToast from '~/components/ui/AppToast.vue'
import { useToastStore } from '~/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Перейти к содержимому</a>

    <header class="app-header">
      <NuxtLink to="/" class="app-brand" aria-label="Заметки — на главную">
        Заметки
      </NuxtLink>
    </header>

    <main id="main-content" class="app-main">
      <slot />
    </main>

    <AppToast :message="toast.message" :tone="toast.tone" @dismiss="toast.dismiss()" />
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.app-header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-brand {
  display: inline-flex;
  min-height: 64px;
  align-items: center;
  padding: 0 var(--space-5);
  color: var(--color-text);
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }
}

.app-main {
  width: min(100%, 1120px);
  margin: 0 auto;
  padding: var(--space-8) var(--space-5);
  flex: 1;
}

@media (max-width: 640px) {
  .app-main {
    padding: var(--space-6) var(--space-4);
  }
}
</style>
