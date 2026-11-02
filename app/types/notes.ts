export type Todo = {
  id: string
  text: string
  done: boolean
}

export type Note = {
  id: string
  title: string
  todos: Todo[]
  createdAt: number
  updatedAt: number
}

export type NotesPayload = {
  version: 1
  notes: Note[]
}

export type DraftPayload = {
  version: 1
  noteId: string
  note: Note
  savedAt: number
}
