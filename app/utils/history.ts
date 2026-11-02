import type { Note, Todo } from '~/types/notes'

export const HISTORY_LIMIT = 50

export type HistoryDirection = 'undo' | 'redo'

export type HistoryCommand =
  | {
      type: 'set-title'
      before: string
      after: string
    }
  | {
      type: 'add-todo'
      todo: Todo
      index: number
    }
  | {
      type: 'remove-todo'
      todo: Todo
      index: number
    }
  | {
      type: 'set-todo-text'
      todoId: string
      before: string
      after: string
    }
  | {
      type: 'toggle-todo'
      todoId: string
      before: boolean
      after: boolean
    }

export type TextEditField =
  | {
      kind: 'title'
    }
  | {
      kind: 'todo'
      todoId: string
    }

type PendingTextEdit = {
  field: TextEditField
  before: string
}

export function setTitle(note: Note, title: string): Note {
  return {
    ...note,
    title
  }
}

export function addTodo(note: Note, todo: Todo, index = note.todos.length): Note {
  if (note.todos.some((item) => item.id === todo.id)) {
    return note
  }

  const todos = [...note.todos]
  const insertAt = Math.max(0, Math.min(index, todos.length))
  todos.splice(insertAt, 0, { ...todo })

  return {
    ...note,
    todos
  }
}

export function removeTodo(note: Note, todoId: string): Note {
  const todos = note.todos.filter((todo) => todo.id !== todoId)

  if (todos.length === note.todos.length) {
    return note
  }

  return {
    ...note,
    todos
  }
}

export function setTodoText(note: Note, todoId: string, text: string): Note {
  return updateTodo(note, todoId, (todo) => ({
    ...todo,
    text
  }))
}

export function toggleTodo(note: Note, todoId: string): Note {
  const todo = note.todos.find((item) => item.id === todoId)

  if (!todo) {
    return note
  }

  return setTodoDone(note, todoId, !todo.done)
}

export function applyHistoryCommand(
  note: Note,
  command: HistoryCommand,
  direction: HistoryDirection
): Note {
  switch (command.type) {
    case 'set-title':
      return setTitle(note, direction === 'undo' ? command.before : command.after)
    case 'add-todo':
      return direction === 'undo'
        ? removeTodo(note, command.todo.id)
        : addTodo(note, command.todo, command.index)
    case 'remove-todo':
      return direction === 'undo'
        ? addTodo(note, command.todo, command.index)
        : removeTodo(note, command.todo.id)
    case 'set-todo-text':
      return setTodoText(note, command.todoId, direction === 'undo' ? command.before : command.after)
    case 'toggle-todo':
      return setTodoDone(
        note,
        command.todoId,
        direction === 'undo' ? command.before : command.after
      )
  }
}

export class DeltaHistory {
  private undoStack: HistoryCommand[] = []
  private redoStack: HistoryCommand[] = []
  private pendingText: PendingTextEdit | null = null

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoCount(): number {
    return this.undoStack.length
  }

  get redoCount(): number {
    return this.redoStack.length
  }

  get undoCommands(): HistoryCommand[] {
    return [...this.undoStack]
  }

  get redoCommands(): HistoryCommand[] {
    return [...this.redoStack]
  }

  beginTextEdit(field: TextEditField, before: string): void {
    this.pendingText = {
      field,
      before
    }
  }

  commitTextEdit(after: string): boolean {
    const pending = this.pendingText
    this.pendingText = null

    if (!pending || pending.before === after) {
      return false
    }

    if (pending.field.kind === 'title') {
      this.recordSetTitle(pending.before, after)
      return true
    }

    this.recordSetTodoText(pending.field.todoId, pending.before, after)
    return true
  }

  recordSetTitle(before: string, after: string): void {
    if (before === after) {
      return
    }

    this.pushUndo({
      type: 'set-title',
      before,
      after
    })
  }

  recordAddTodo(todo: Todo, index: number): void {
    this.pushUndo({
      type: 'add-todo',
      todo: { ...todo },
      index
    })
  }

  recordRemoveTodo(todo: Todo, index: number): void {
    this.pushUndo({
      type: 'remove-todo',
      todo: { ...todo },
      index
    })
  }

  recordSetTodoText(todoId: string, before: string, after: string): void {
    if (before === after) {
      return
    }

    this.pushUndo({
      type: 'set-todo-text',
      todoId,
      before,
      after
    })
  }

  recordToggleTodo(todoId: string, before: boolean, after: boolean): void {
    if (before === after) {
      return
    }

    this.pushUndo({
      type: 'toggle-todo',
      todoId,
      before,
      after
    })
  }

  undo(note: Note): Note | null {
    const command = this.undoStack.pop()

    if (!command) {
      return null
    }

    this.redoStack.push(command)

    return applyHistoryCommand(note, command, 'undo')
  }

  redo(note: Note): Note | null {
    const command = this.redoStack.pop()

    if (!command) {
      return null
    }

    this.undoStack.push(command)

    return applyHistoryCommand(note, command, 'redo')
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.pendingText = null
  }

  private pushUndo(command: HistoryCommand): void {
    this.undoStack.push(command)

    if (this.undoStack.length > HISTORY_LIMIT) {
      this.undoStack.shift()
    }

    this.redoStack = []
  }
}

function updateTodo(note: Note, todoId: string, update: (todo: Todo) => Todo): Note {
  let changed = false

  const todos = note.todos.map((todo) => {
    if (todo.id !== todoId) {
      return todo
    }

    changed = true
    return update(todo)
  })

  if (!changed) {
    return note
  }

  return {
    ...note,
    todos
  }
}

function setTodoDone(note: Note, todoId: string, done: boolean): Note {
  return updateTodo(note, todoId, (todo) => ({
    ...todo,
    done
  }))
}
