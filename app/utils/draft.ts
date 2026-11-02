import type { DraftPayload, Note } from '~/types/notes'
import { parseDraftPayload, serializeDraftPayload, type SchemaFailureReason } from '~/utils/schema'

export const DRAFT_STORAGE_PREFIX = 'notes-app:draft:v1:'
export const DRAFT_WRITE_DEBOUNCE_MS = 500

export type DraftFailureReason = SchemaFailureReason | 'storage-error'

export type DraftReadResult =
  | {
      ok: true
      draft: DraftPayload | null
    }
  | {
      ok: false
      reason: DraftFailureReason
    }

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>
type StorageRemover = Pick<Storage, 'removeItem'>

export function draftStorageKey(noteId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${noteId}`
}

export function readDraft(noteId: string, storage?: StorageReader): DraftReadResult {
  const target = storage ?? getLocalStorage()

  if (!target) {
    return {
      ok: true,
      draft: null
    }
  }

  let raw: string | null

  try {
    raw = target.getItem(draftStorageKey(noteId))
  } catch {
    return {
      ok: false,
      reason: 'storage-error'
    }
  }

  const result = parseDraftPayload(raw)

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason
    }
  }

  if (!result.draft || result.draft.noteId !== noteId) {
    return {
      ok: true,
      draft: null
    }
  }

  return result
}

export function writeDraft(draft: DraftPayload, storage?: StorageWriter): boolean {
  const target = storage ?? getLocalStorage()

  if (!target) {
    return false
  }

  try {
    target.setItem(draftStorageKey(draft.noteId), serializeDraftPayload(draft))
    return true
  } catch {
    return false
  }
}

export function removeDraft(noteId: string, storage?: StorageRemover): boolean {
  const target = storage ?? getLocalStorage()

  if (!target) {
    return true
  }

  try {
    target.removeItem(draftStorageKey(noteId))
    return true
  } catch {
    return false
  }
}

export function hasSameDraftContent(
  left: Pick<Note, 'title' | 'todos'>,
  right: Pick<Note, 'title' | 'todos'>
): boolean {
  if (left.title !== right.title || left.todos.length !== right.todos.length) {
    return false
  }

  return left.todos.every((todo, index) => {
    const other = right.todos[index]

    return (
      other !== undefined &&
      todo.id === other.id &&
      todo.text === other.text &&
      todo.done === other.done
    )
  })
}

function getLocalStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return localStorage
}
