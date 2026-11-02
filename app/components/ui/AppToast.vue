<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string | null
    tone?: 'info' | 'error'
  }>(),
  {
    message: null,
    tone: 'info'
  }
)

defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="toast-region" role="status" aria-live="polite" aria-atomic="true">
      <Transition name="toast">
        <div v-if="message" class="app-toast" :class="`app-toast--${tone}`">
          <p class="app-toast__text">{{ message }}</p>
          <button
            type="button"
            class="app-toast__close"
            aria-label="Закрыть уведомление"
            @click="$emit('dismiss')"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.toast-region {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
}

.app-toast {
  display: flex;
  max-width: min(90vw, 420px);
  min-height: 44px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-text);
  color: var(--color-surface);
  box-shadow: var(--shadow-md);
  pointer-events: auto;

  &--error {
    background: var(--color-danger-strong);
  }

  &__text {
    margin: 0;
    font-size: 0.9375rem;
  }

  &__close {
    display: inline-flex;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-size: 1.25rem;
    line-height: 1;

    &:hover {
      background: rgb(255 255 255 / 12%);
    }
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .toast-region {
    right: var(--space-4);
    bottom: var(--space-4);
    left: var(--space-4);
  }

  .app-toast {
    max-width: none;
  }
}
</style>
