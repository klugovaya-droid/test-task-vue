import { describe, expect, it } from 'vitest'
import type { Note, Todo } from '~/types/notes'
import {
  HISTORY_LIMIT,
  DeltaHistory,
  addTodo,
  applyHistoryCommand,
  removeTodo,
  setTitle,
  setTodoText,
  toggleTodo
} from '~/utils/history'

const firstTodo: Todo = { id: 'todo-1', text: 'Первая', done: false }
const secondTodo: Todo = { id: 'todo-2', text: 'Вторая', done: true }
const thirdTodo: Todo = { id: 'todo-3', text: 'Третья', done: false }

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Заметка',
    todos: [{ ...firstTodo }, { ...secondTodo }],
    createdAt: 1,
    updatedAt: 2,
    ...overrides
  }
}

function requireNote(note: Note | null): Note {
  if (!note) {
    throw new Error('Expected a note')
  }

  return note
}

describe('history helpers', () => {
  it('sets a title without mutating the source note', () => {
    const note = createNote()
    const updated = setTitle(note, 'Новое название')

    expect(updated.title).toBe('Новое название')
    expect(updated).not.toBe(note)
    expect(note.title).toBe('Заметка')
  })

  it('inserts todos at the requested index without mutating the source', () => {
    const note = createNote()
    const updated = addTodo(note, thirdTodo, 1)

    expect(updated.todos.map((todo) => todo.id)).toEqual(['todo-1', 'todo-3', 'todo-2'])
    expect(updated).not.toBe(note)
    expect(note.todos.map((todo) => todo.id)).toEqual(['todo-1', 'todo-2'])
  })

  it('appends todos by default and clamps an out-of-range index', () => {
    const note = createNote()

    expect(addTodo(note, thirdTodo).todos.map((todo) => todo.id)).toEqual([
      'todo-1',
      'todo-2',
      'todo-3'
    ])
    expect(addTodo(note, thirdTodo, 99).todos.map((todo) => todo.id)).toEqual([
      'todo-1',
      'todo-2',
      'todo-3'
    ])
    expect(addTodo(note, thirdTodo, -5).todos.map((todo) => todo.id)).toEqual([
      'todo-3',
      'todo-1',
      'todo-2'
    ])
  })

  it('ignores a todo with an existing id', () => {
    const note = createNote()
    const updated = addTodo(note, { ...firstTodo, text: 'Дубль' })

    expect(updated.todos).toEqual(note.todos)
  })

  it('removes a todo by id without mutating the source', () => {
    const note = createNote()
    const updated = removeTodo(note, 'todo-1')

    expect(updated.todos).toEqual([secondTodo])
    expect(updated).not.toBe(note)
    expect(note.todos).toHaveLength(2)
  })

  it('keeps the note unchanged when the todo is missing', () => {
    const note = createNote()
    const updated = removeTodo(note, 'missing')

    expect(updated.todos).toEqual(note.todos)
  })

  it('updates one todo text without touching the others', () => {
    const note = createNote()
    const updated = setTodoText(note, 'todo-1', 'Изменённая')

    expect(updated.todos).toEqual([
      { id: 'todo-1', text: 'Изменённая', done: false },
      secondTodo
    ])
    expect(note.todos[0]).toEqual(firstTodo)
  })

  it('toggles only the requested todo', () => {
    const note = createNote()
    const updated = toggleTodo(note, 'todo-1')

    expect(updated.todos).toEqual([
      { ...firstTodo, done: true },
      secondTodo
    ])
    expect(note.todos[0]).toEqual(firstTodo)
  })

  it('keeps the note unchanged for unknown todo ids', () => {
    const note = createNote()

    expect(setTodoText(note, 'missing', 'Текст').todos).toEqual(note.todos)
    expect(toggleTodo(note, 'missing').todos).toEqual(note.todos)
  })
})

describe('applyHistoryCommand', () => {
  const note = createNote()

  it('applies title commands in both directions', () => {
    const command = { type: 'set-title', before: 'Старое', after: 'Новое' } as const

    expect(applyHistoryCommand(note, command, 'undo').title).toBe('Старое')
    expect(applyHistoryCommand(note, command, 'redo').title).toBe('Новое')
  })

  it('undoes an added todo and redoes it at the same index', () => {
    const command = { type: 'add-todo', todo: thirdTodo, index: 1 } as const
    const withTodo = addTodo(note, thirdTodo, 1)

    expect(applyHistoryCommand(withTodo, command, 'undo').todos.map((todo) => todo.id)).toEqual([
      'todo-1',
      'todo-2'
    ])
    expect(applyHistoryCommand(note, command, 'redo').todos.map((todo) => todo.id)).toEqual([
      'todo-1',
      'todo-3',
      'todo-2'
    ])
  })

  it('restores a removed todo at its index', () => {
    const command = { type: 'remove-todo', todo: firstTodo, index: 0 } as const
    const withoutTodo = removeTodo(note, 'todo-1')

    expect(applyHistoryCommand(withoutTodo, command, 'undo').todos).toEqual(note.todos)
    expect(applyHistoryCommand(note, command, 'redo').todos).toEqual([secondTodo])
  })

  it('applies todo text commands in both directions', () => {
    const command = {
      type: 'set-todo-text',
      todoId: 'todo-1',
      before: 'Старый текст',
      after: 'Новый текст'
    } as const
    const changed = setTodoText(note, 'todo-1', 'Новый текст')

    expect(applyHistoryCommand(changed, command, 'undo').todos[0]?.text).toBe('Старый текст')
    expect(applyHistoryCommand(note, command, 'redo').todos[0]?.text).toBe('Новый текст')
  })

  it('applies toggle commands in both directions', () => {
    const command = {
      type: 'toggle-todo',
      todoId: 'todo-1',
      before: false,
      after: true
    } as const
    const toggled = toggleTodo(note, 'todo-1')

    expect(applyHistoryCommand(toggled, command, 'undo').todos[0]?.done).toBe(false)
    expect(applyHistoryCommand(note, command, 'redo').todos[0]?.done).toBe(true)
  })
})

describe('DeltaHistory', () => {
  it('starts empty', () => {
    const history = new DeltaHistory()

    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.undoCount).toBe(0)
    expect(history.redoCount).toBe(0)
    expect(history.undo(createNote())).toBeNull()
    expect(history.redo(createNote())).toBeNull()
  })

  it('undoes and redoes recorded changes', () => {
    const history = new DeltaHistory()
    const original = createNote({ title: 'Черновик' })
    const changed = setTitle(original, 'Готово')

    history.recordSetTitle('Черновик', 'Готово')

    const undone = requireNote(history.undo(changed))

    expect(undone.title).toBe('Черновик')
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
    expect(history.redoCount).toBe(1)

    const redone = requireNote(history.redo(undone))

    expect(redone.title).toBe('Готово')
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('stores deltas instead of note snapshots', () => {
    const history = new DeltaHistory()
    const todo = { ...thirdTodo }

    history.recordSetTitle('Черновик', 'Готово')
    history.recordAddTodo(todo, 2)
    history.recordRemoveTodo(firstTodo, 0)
    history.recordSetTodoText('todo-2', 'Было', 'Стало')
    history.recordToggleTodo('todo-2', true, false)

    expect(history.undoCommands).toEqual([
      { type: 'set-title', before: 'Черновик', after: 'Готово' },
      { type: 'add-todo', todo, index: 2 },
      { type: 'remove-todo', todo: firstTodo, index: 0 },
      { type: 'set-todo-text', todoId: 'todo-2', before: 'Было', after: 'Стало' },
      { type: 'toggle-todo', todoId: 'todo-2', before: true, after: false }
    ])

    for (const command of history.undoCommands) {
      expect(command).not.toHaveProperty('note')
      expect(command).not.toHaveProperty('snapshot')
    }
  })

  it('copies a todo into the command', () => {
    const history = new DeltaHistory()
    const todo = { ...thirdTodo }

    history.recordAddTodo(todo, 0)
    todo.text = 'Изменён после записи'

    expect(history.undoCommands[0]).toMatchObject({
      type: 'add-todo',
      todo: { text: 'Третья' }
    })
  })

  it('does not record no-op changes', () => {
    const history = new DeltaHistory()

    history.recordSetTitle('Одинаково', 'Одинаково')
    history.recordSetTodoText('todo-1', 'Текст', 'Текст')
    history.recordToggleTodo('todo-1', true, true)

    expect(history.undoCount).toBe(0)
    expect(history.canUndo).toBe(false)
  })

  it('clears the redo branch after a new change', () => {
    const history = new DeltaHistory()
    const note = createNote({ title: 'C' })

    history.recordSetTitle('A', 'B')
    history.recordSetTitle('B', 'C')

    const undone = requireNote(history.undo(note))

    expect(undone.title).toBe('B')
    expect(history.canRedo).toBe(true)

    history.recordSetTitle('B', 'D')

    expect(history.canRedo).toBe(false)
    expect(history.redo(undone)).toBeNull()
    expect(history.undoCount).toBe(2)
  })

  it(`keeps only the last ${HISTORY_LIMIT} commands`, () => {
    const history = new DeltaHistory()
    let note = createNote({ title: 'v0' })

    for (let index = 1; index <= HISTORY_LIMIT + 1; index += 1) {
      history.recordSetTitle(`v${index - 1}`, `v${index}`)
      note = setTitle(note, `v${index}`)
    }

    expect(history.undoCount).toBe(HISTORY_LIMIT)

    for (let index = 0; index < HISTORY_LIMIT; index += 1) {
      note = requireNote(history.undo(note))
    }

    expect(note.title).toBe('v1')
    expect(history.canUndo).toBe(false)
    expect(history.undo(note)).toBeNull()
    expect(history.redoCount).toBe(HISTORY_LIMIT)

    for (let index = 0; index < HISTORY_LIMIT; index += 1) {
      note = requireNote(history.redo(note))
    }

    expect(note.title).toBe(`v${HISTORY_LIMIT + 1}`)
  })

  it('returns a copy of both stacks', () => {
    const history = new DeltaHistory()

    history.recordSetTitle('A', 'B')

    const commands = history.undoCommands
    commands.pop()

    expect(commands).toEqual([])
    expect(history.undoCount).toBe(1)
  })

  it('groups a text edit between begin and commit', () => {
    const history = new DeltaHistory()

    history.beginTextEdit({ kind: 'title' }, 'Черновик')
    expect(history.commitTextEdit('Черновик')).toBe(false)
    expect(history.undoCount).toBe(0)

    history.beginTextEdit({ kind: 'title' }, 'Черновик')
    expect(history.commitTextEdit('Готово')).toBe(true)

    expect(history.undoCommands).toEqual([
      { type: 'set-title', before: 'Черновик', after: 'Готово' }
    ])
  })

  it('records todo text edits with the todo id', () => {
    const history = new DeltaHistory()

    history.beginTextEdit({ kind: 'todo', todoId: 'todo-2' }, 'Старое')
    expect(history.commitTextEdit('Новое')).toBe(true)

    expect(history.undoCommands).toEqual([
      { type: 'set-todo-text', todoId: 'todo-2', before: 'Старое', after: 'Новое' }
    ])
  })

  it('ignores a commit without an active text edit', () => {
    const history = new DeltaHistory()

    expect(history.commitTextEdit('Текст')).toBe(false)
    expect(history.undoCount).toBe(0)
  })

  it('clears both stacks and the pending text edit', () => {
    const history = new DeltaHistory()

    history.recordSetTitle('A', 'B')
    history.undo(createNote())
    history.beginTextEdit({ kind: 'title' }, 'B')

    history.clear()

    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.commitTextEdit('C')).toBe(false)
    expect(history.undoCount).toBe(0)
  })

  it('undoes add, remove, and toggle as single atomic steps', () => {
    const history = new DeltaHistory()
    const note = createNote()
    const withTodo = addTodo(note, thirdTodo, 1)
    const toggled = toggleTodo(withTodo, 'todo-1')
    const removed = removeTodo(toggled, 'todo-2')

    history.recordAddTodo(thirdTodo, 1)
    history.recordToggleTodo('todo-1', false, true)
    history.recordRemoveTodo(secondTodo, 2)

    expect(history.undoCount).toBe(3)

    const undoneRemove = requireNote(history.undo(removed))

    expect(undoneRemove.todos.map((todo) => todo.id)).toEqual(['todo-1', 'todo-3', 'todo-2'])
    expect(undoneRemove.todos[0]?.done).toBe(true)

    const undoneToggle = requireNote(history.undo(undoneRemove))

    expect(undoneToggle.todos[0]?.done).toBe(false)
    expect(undoneToggle.todos).toHaveLength(3)

    const undoneAdd = requireNote(history.undo(undoneToggle))

    expect(undoneAdd.todos).toEqual(note.todos)
  })
})
