import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastTone = 'info' | 'error'

export const useToastStore = defineStore('toast', () => {
  const message = ref<string | null>(null)
  const tone = ref<ToastTone>('info')

  function show(nextMessage: string, nextTone: ToastTone = 'info'): void {
    message.value = nextMessage
    tone.value = nextTone
  }

  function dismiss(): void {
    message.value = null
  }

  return {
    message,
    tone,
    show,
    dismiss
  }
})
