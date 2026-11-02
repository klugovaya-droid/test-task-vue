import type { DraftPayload, Note, NotesPayload, Todo } from '~/types/notes'
import { TODO_TEXT_MAX_LENGTH, TITLE_MAX_LENGTH } from '~/utils/validation'

export const CURRENT_SCHEMA_VERSION = 1 as const
export const NOTES_STORAGE_KEY = 'notes-app:data'
export const BACKUP_STORAGE_KEY = 'notes-app:backup'

export type SchemaFailureReason = 'invalid-json' | 'invalid-schema' | 'unsupported-version'

export type SchemaFailure = {
  ok: false
  reason: SchemaFailureReason
  raw: string
  version?: number
}

export type NotesParseResult =
  | {
      ok: true
      notes: Note[]
      empty: boolean
    }
  | SchemaFailure

export type DraftParseResult =
  | {
      ok: true
      draft: DraftPayload | null
    }
  | SchemaFailure

export function isTodo(value: unknown): value is Todo {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.id) &&
    isText(value.text, TODO_TEXT_MAX_LENGTH) &&
    typeof value.done === 'boolean'
  )
}

export function isNote(value: unknown): value is Note {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.id) &&
    isText(value.title, TITLE_MAX_LENGTH) &&
    Array.isArray(value.todos) &&
    value.todos.every(isTodo) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

export function migrateNotesPayload(value: unknown): NotesPayload | null {
  if (!isRecord(value) || value.version !== CURRENT_SCHEMA_VERSION) {
    return null
  }

  const notes = parseNotes(value.notes)

  if (!notes) {
    return null
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    notes
  }
}

export function migrateDraftPayload(value: unknown): DraftPayload | null {
  if (!isRecord(value) || value.version !== CURRENT_SCHEMA_VERSION) {
    return null
  }

  if (!isNonEmptyString(value.noteId) || !isNote(value.note) || !isTimestamp(value.savedAt)) {
    return null
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    noteId: value.noteId,
    note: value.note,
    savedAt: value.savedAt
  }
}

export function parseNotesPayload(raw: string | null): NotesParseResult {
  if (raw === null || raw.trim() === '') {
    return {
      ok: true,
      notes: [],
      empty: true
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return failure('invalid-json', raw)
  }

  if (!isRecord(parsed) || typeof parsed.version !== 'number') {
    return failure('invalid-schema', raw)
  }

  if (parsed.version !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-version',
      raw,
      version: parsed.version
    }
  }

  const payload = migrateNotesPayload(parsed)

  if (!payload) {
    return failure('invalid-schema', raw)
  }

  return {
    ok: true,
    notes: payload.notes,
    empty: false
  }
}

export function parseDraftPayload(raw: string | null): DraftParseResult {
  if (raw === null || raw.trim() === '') {
    return {
      ok: true,
      draft: null
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return failure('invalid-json', raw)
  }

  if (!isRecord(parsed) || typeof parsed.version !== 'number') {
    return failure('invalid-schema', raw)
  }

  if (parsed.version !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-version',
      raw,
      version: parsed.version
    }
  }

  const draft = migrateDraftPayload(parsed)

  if (!draft) {
    return failure('invalid-schema', raw)
  }

  return {
    ok: true,
    draft
  }
}

export function serializeNotesPayload(notes: Note[]): string {
  const payload: NotesPayload = {
    version: CURRENT_SCHEMA_VERSION,
    notes
  }

  return JSON.stringify(payload)
}

export function serializeDraftPayload(draft: DraftPayload): string {
  const payload: DraftPayload = {
    ...draft,
    version: CURRENT_SCHEMA_VERSION
  }

  return JSON.stringify(payload)
}

export function backupCorruptedPayload(
  raw: string,
  storage: Pick<Storage, 'setItem'> = localStorage
): boolean {
  try {
    storage.setItem(BACKUP_STORAGE_KEY, raw)
    return true
  } catch {
    return false
  }
}

function parseNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const notes: Note[] = []

  for (const item of value) {
    if (!isNote(item)) {
      return null
    }

    notes.push(item)
  }

  return notes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isText(value: unknown, maxLength: number): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const text = value.trim()

  return text.length > 0 && Array.from(text).length <= maxLength
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function failure(reason: SchemaFailureReason, raw: string): SchemaFailure {
  return {
    ok: false,
    reason,
    raw
  }
}
