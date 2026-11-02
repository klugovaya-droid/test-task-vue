import { useNotesStore } from '~/stores/notes'
import { NOTES_STORAGE_KEY } from '~/utils/schema'

export default defineNuxtPlugin(() => {
  const notes = useNotesStore()

  notes.hydrate()

  const flush = () => {
    notes.flush()
  }

  const flushWhenHidden = () => {
    if (document.visibilityState === 'hidden') {
      notes.flush()
    }
  }

  const syncFromStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== NOTES_STORAGE_KEY) {
      return
    }

    notes.syncFromStorage(event.newValue)
  }

  window.addEventListener('pagehide', flush)
  window.addEventListener('visibilitychange', flushWhenHidden)
  window.addEventListener('storage', syncFromStorage)
})
