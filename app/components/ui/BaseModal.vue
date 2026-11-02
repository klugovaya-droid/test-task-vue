<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import AppButton from '~/components/ui/AppButton.vue'
import {
  getFocusableElements,
  getNextFocusTarget,
  lockBodyScroll,
  unlockBodyScroll
} from '~/utils/focus-trap'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    role?: 'dialog' | 'alertdialog'
    size?: 'sm' | 'md'
    closeOnOverlay?: boolean
    closeOnEscape?: boolean
    showClose?: boolean
  }>(),
  {
    role: 'dialog',
    size: 'md',
    closeOnOverlay: true,
    closeOnEscape: true,
    showClose: true
  }
)

const emit = defineEmits<{
  close: []
  escape: []
}>()

const modalId = useId()
const titleId = `modal-title-${modalId}`
const descriptionId = `modal-description-${modalId}`
const hasDescription = computed(() => Boolean(props.description))

const panel = ref<HTMLElement | null>(null)

let active = false
let previouslyFocused: HTMLElement | null = null

watch(
  () => props.open,
  (open) => {
    if (open) {
      void activate()
    } else {
      deactivate()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (!active) {
    return
  }

  active = false
  document.removeEventListener('keydown', handleKeydown)
  unlockBodyScroll()
})

async function activate(): Promise<void> {
  if (active) {
    return
  }

  active = true
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  lockBodyScroll()
  document.addEventListener('keydown', handleKeydown)

  await nextTick()

  if (!active) {
    return
  }

  const preferred = panel.value?.querySelector<HTMLElement>('[data-autofocus]')
  const fallback = panel.value ? getFocusableElements(panel.value)[0] : undefined
  const target = preferred ?? fallback ?? panel.value

  target?.focus()
}

function deactivate(restoreFocus = true): void {
  if (!active) {
    return
  }

  active = false
  document.removeEventListener('keydown', handleKeydown)
  unlockBodyScroll()

  if (!restoreFocus) {
    previouslyFocused = null
    return
  }

  const target = previouslyFocused
  previouslyFocused = null

  void nextTick(() => {
    target?.focus()
  })
}

function handleKeydown(event: KeyboardEvent): void {
  if (!active) {
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('escape')

    if (props.closeOnEscape) {
      emit('close')
    }

    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const currentPanel = panel.value

  if (!currentPanel) {
    return
  }

  const next = getNextFocusTarget(currentPanel, document.activeElement, event.shiftKey)

  event.preventDefault()

  if (next) {
    next.focus()
  } else {
    currentPanel.focus()
  }
}

function handleOverlayClick(): void {
  if (props.closeOnOverlay) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal" @click.self="handleOverlayClick">
        <div
          ref="panel"
          class="modal__panel"
          :class="`modal__panel--${size}`"
          :role="role"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="hasDescription ? descriptionId : undefined"
          tabindex="-1"
        >
          <header class="modal__header">
            <h2 :id="titleId" class="modal__title">{{ title }}</h2>

            <AppButton
              v-if="showClose"
              variant="ghost"
              size="sm"
              aria-label="Закрыть модальное окно"
              @click="emit('close')"
            >
              <span aria-hidden="true">×</span>
            </AppButton>
          </header>

          <div class="modal__body">
            <p v-if="description" :id="descriptionId" class="modal__description">
              {{ description }}
            </p>
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgb(23 35 27 / 48%);

  &__panel {
    display: flex;
    width: 100%;
    max-width: 32rem;
    max-height: calc(100vh - 2 * var(--space-4));
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-md);

    &--sm {
      max-width: 26rem;
    }
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-5) var(--space-3);
  }

  &__title {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.3;
  }

  &__body {
    padding: 0 var(--space-5) var(--space-5);
    overflow-y: auto;
  }

  &__description {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-muted);
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-fast);
}

.modal-enter-active .modal__panel,
.modal-leave-active .modal__panel {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal__panel,
.modal-leave-to .modal__panel {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@media (max-width: 640px) {
  .modal {
    align-items: flex-end;
    padding: var(--space-3);

    &__panel {
      max-height: calc(100vh - 2 * var(--space-3));
    }

    &__footer {
      flex-direction: column;

      :deep(.app-button) {
        width: 100%;
      }
    }
  }
}
</style>
