import { describe, expect, it } from 'vitest'
import {
  BACKUP_STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
  backupCorruptedPayload,
  migrateDraftPayload,
  migrateNotesPayload,
  parseDraftPayload,
  parseNotesPayload,
  serializeDraftPayload,
  serializeNotesPayload
} from '~/utils/schema'
import type { DraftPayload, Note } from '~/types/notes'

const note: Note = {
  id: 'note-1',
  title: 'Заметка',
  todos: [
    { id: 'todo-1', text: 'Первая', done: false },
    { id: 'todo-2', text: 'Вторая', done: true }
  ],
  createdAt: 1,
  updatedAt: 2
}

describe('notes payload', () => {
  it('round-trips a versioned payload', () => {
    const raw = serializeNotesPayload([note])
    const parsed = parseNotesPayload(raw)

    expect(JSON.parse(raw)).toMatchObject({
      version: CURRENT_SCHEMA_VERSION,
      notes: [note]
    })
    expect(parsed).toEqual({
      ok: true,
      notes: [note],
      empty: false
    })
  })

  it('treats missing and blank storage values as empty', () => {
    expect(parseNotesPayload(null)).toEqual({
      ok: true,
      notes: [],
      empty: true
    })
    expect(parseNotesPayload('   ')).toEqual({
      ok: true,
      notes: [],
      empty: true
    })
  })

  it('rejects payloads without a version', () => {
    const raw = JSON.stringify({ notes: [note] })

    expect(parseNotesPayload(raw)).toMatchObject({
      ok: false,
      reason: 'invalid-schema',
      raw
    })
  })

  it('rejects a future schema version', () => {
    const raw = JSON.stringify({ version: CURRENT_SCHEMA_VERSION + 1, notes: [] })
    const result = parseNotesPayload(raw)

    if (result.ok) {
      throw new Error('Expected a schema failure')
    }

    expect(result.reason).toBe('unsupported-version')
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION + 1)
  })

  it('rejects broken JSON', () => {
    const raw = '{"version":1,"notes":['

    expect(parseNotesPayload(raw)).toMatchObject({
      ok: false,
      reason: 'invalid-json',
      raw
    })
  })

  it('rejects a note with an empty title', () => {
    const raw = JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      notes: [{ ...note, title: '   ' }]
    })

    expect(parseNotesPayload(raw)).toMatchObject({
      ok: false,
      reason: 'invalid-schema'
    })
  })

  it('rejects a note with an empty todo', () => {
    const raw = JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      notes: [
        {
          ...note,
          todos: [{ id: 'todo-1', text: ' ', done: false }]
        }
      ]
    })

    expect(parseNotesPayload(raw)).toMatchObject({
      ok: false,
      reason: 'invalid-schema'
    })
  })

  it('accepts a note without todos', () => {
    const emptyNote: Note = { ...note, todos: [] }
    const parsed = parseNotesPayload(serializeNotesPayload([emptyNote]))

    expect(parsed).toEqual({
      ok: true,
      notes: [emptyNote],
      empty: false
    })
  })
})

describe('draft payload', () => {
  const draft: DraftPayload = {
    version: CURRENT_SCHEMA_VERSION,
    noteId: 'new',
    note,
    savedAt: 3
  }

  it('round-trips a versioned draft', () => {
    expect(parseDraftPayload(serializeDraftPayload(draft))).toEqual({
      ok: true,
      draft
    })
  })

  it('returns null for a missing draft', () => {
    expect(parseDraftPayload(null)).toEqual({
      ok: true,
      draft: null
    })
  })

  it('rejects a future draft version', () => {
    const raw = JSON.stringify({ ...draft, version: CURRENT_SCHEMA_VERSION + 1 })
    const result = parseDraftPayload(raw)

    if (result.ok) {
      throw new Error('Expected a draft failure')
    }

    expect(result.reason).toBe('unsupported-version')
  })

  it('rejects a draft with an empty note id', () => {
    const raw = JSON.stringify({ ...draft, noteId: ' ' })

    expect(parseDraftPayload(raw)).toMatchObject({
      ok: false,
      reason: 'invalid-schema'
    })
  })
})

describe('payload migration', () => {
  it('accepts the current notes version', () => {
    expect(migrateNotesPayload({ version: CURRENT_SCHEMA_VERSION, notes: [note] })).toEqual({
      version: CURRENT_SCHEMA_VERSION,
      notes: [note]
    })
  })

  it('rejects an unknown notes version', () => {
    expect(migrateNotesPayload({ version: CURRENT_SCHEMA_VERSION + 1, notes: [] })).toBeNull()
  })

  it('accepts the current draft version', () => {
    const draft: DraftPayload = {
      version: CURRENT_SCHEMA_VERSION,
      noteId: note.id,
      note,
      savedAt: 3
    }

    expect(migrateDraftPayload(draft)).toEqual(draft)
  })

  it('rejects an unknown draft version', () => {
    expect(
      migrateDraftPayload({
        version: CURRENT_SCHEMA_VERSION + 1,
        noteId: note.id,
        note,
        savedAt: 3
      })
    ).toBeNull()
  })
})

describe('backupCorruptedPayload', () => {
  it('stores the raw value in the backup key', () => {
    const raw = '{"version":999}'

    expect(backupCorruptedPayload(raw)).toBe(true)
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe(raw)
  })

  it('returns false when storage rejects the write', () => {
    const storage: Pick<Storage, 'setItem'> = {
      setItem() {
        throw new Error('Quota exceeded')
      }
    }

    expect(backupCorruptedPayload('broken', storage)).toBe(false)
  })
})
