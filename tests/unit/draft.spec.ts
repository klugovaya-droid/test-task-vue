import { describe, expect, it } from 'vitest'
import type { DraftPayload, Note } from '~/types/notes'
import { serializeDraftPayload } from '~/utils/schema'
import {
  DRAFT_STORAGE_PREFIX,
  draftStorageKey,
  hasSameDraftContent,
  readDraft,
  removeDraft,
  writeDraft
} from '~/utils/draft'

const note: Note = {
  id: 'note-1',
  title: 'Заметка',
  todos: [
    { id: 'todo-1', text: 'Первая', done: false },
    { id: 'todo-2', text: 'Вторая', done: true }
  ],
  createdAt: 1_000,
  updatedAt: 2_000
}

const draft: DraftPayload = {
  version: 1,
  noteId: note.id,
  note,
  savedAt: 3_000
}

describe('draft storage keys', () => {
  it('builds a versioned key per note', () => {
    expect(draftStorageKey('note-1')).toBe(`${DRAFT_STORAGE_PREFIX}note-1`)
    expect(draftStorageKey('new')).toBe('notes-app:draft:v1:new')
  })
})

describe('readDraft', () => {
  it('returns null for a missing draft', () => {
    expect(readDraft(note.id)).toEqual({ ok: true, draft: null })
  })

  it('round-trips a written draft', () => {
    expect(writeDraft(draft)).toBe(true)

    expect(readDraft(note.id)).toEqual({ ok: true, draft })
  })

  it('rejects invalid json', () => {
    localStorage.setItem(draftStorageKey(note.id), '{')

    expect(readDraft(note.id)).toEqual({ ok: false, reason: 'invalid-json' })
  })

  it('rejects an unsupported schema version', () => {
    localStorage.setItem(draftStorageKey(note.id), JSON.stringify({ ...draft, version: 2 }))

    expect(readDraft(note.id)).toEqual({ ok: false, reason: 'unsupported-version' })
  })

  it('ignores a payload stored under another note id', () => {
    localStorage.setItem(
      draftStorageKey(note.id),
      serializeDraftPayload({ ...draft, noteId: 'note-2' })
    )

    expect(readDraft(note.id)).toEqual({ ok: true, draft: null })
  })

  it('reports a storage read error', () => {
    const storage = {
      getItem: () => {
        throw new Error('Blocked')
      }
    }

    expect(readDraft(note.id, storage)).toEqual({ ok: false, reason: 'storage-error' })
  })
})

describe('writeDraft', () => {
  it('reports a storage write error', () => {
    const storage = {
      setItem: () => {
        throw new Error('Quota exceeded')
      }
    }

    expect(writeDraft(draft, storage)).toBe(false)
  })
})

describe('removeDraft', () => {
  it('removes a stored draft', () => {
    writeDraft(draft)

    expect(removeDraft(note.id)).toBe(true)
    expect(localStorage.getItem(draftStorageKey(note.id))).toBeNull()
  })

  it('reports a storage remove error', () => {
    const storage = {
      removeItem: () => {
        throw new Error('Blocked')
      }
    }

    expect(removeDraft(note.id, storage)).toBe(false)
  })
})

describe('hasSameDraftContent', () => {
  it('compares only editable content', () => {
    expect(
      hasSameDraftContent(note, { ...note, id: 'other', createdAt: 5, updatedAt: 6 })
    ).toBe(true)
  })

  it('detects title, todo text, order and length changes', () => {
    expect(hasSameDraftContent(note, { ...note, title: 'Другая' })).toBe(false)
    expect(
      hasSameDraftContent(note, {
        ...note,
        todos: [{ ...note.todos[0]!, text: 'Изменена' }, note.todos[1]!]
      })
    ).toBe(false)
    expect(hasSameDraftContent(note, { ...note, todos: [...note.todos].reverse() })).toBe(false)
    expect(hasSameDraftContent(note, { ...note, todos: note.todos.slice(0, 1) })).toBe(false)
  })
})
