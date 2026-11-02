import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import type { Note, NotesPayload } from '../../app/types/notes'

const existingNote: Note = {
  id: 'note-edit',
  title: 'Старая заметка',
  todos: [{ id: 'todo-1', text: 'Старая задача', done: false }],
  createdAt: 1_000,
  updatedAt: 2_000
}

const deletableNote: Note = {
  id: 'note-delete',
  title: 'Заметка на удаление',
  todos: [],
  createdAt: 3_000,
  updatedAt: 4_000
}

let baseUrl = ''
let browser: Browser

beforeAll(async () => {
  const fromEnv = process.env.E2E_BASE_URL

  if (!fromEnv) {
    throw new Error('E2E_BASE_URL is not set by global setup')
  }

  baseUrl = fromEnv
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser?.close()
})

async function openEditor(page: Page, notes: Note[], path: string): Promise<void> {
  const payload: NotesPayload = {
    version: 1,
    notes
  }

  await page.addInitScript((data: NotesPayload) => {
    if (!localStorage.getItem('notes-app:data')) {
      localStorage.setItem('notes-app:data', JSON.stringify(data))
    }
  }, payload)

  await page.goto(`${baseUrl}${path}`)
}

async function readStoredNotes(page: Page): Promise<Note[]> {
  return page.evaluate(() => {
    const payload = JSON.parse(localStorage.getItem('notes-app:data') ?? '{}') as NotesPayload

    return payload.notes ?? []
  })
}

async function waitForHeading(page: Page, level: 1 | 2): Promise<string> {
  return (await page.getByRole('heading', { level }).textContent())?.trim() ?? ''
}

describe('editor page', () => {
  it('creates a note with todos, saves it and restores it after reload', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [], '/notes/new')

      await expect.poll(() => waitForHeading(page, 1)).toBe('Новая заметка')

      const saveButton = page.getByRole('button', { name: 'Сохранить' })
      const titleInput = page.getByLabel('Название')
      const newTodoInput = page.getByLabel('Новая задача')

      await expect.poll(() => saveButton.isDisabled()).toBe(true)

      await titleInput.fill('  Моя заметка  ')
      await expect.poll(() => page.getByText('Не сохранено').isVisible()).toBe(true)

      await newTodoInput.fill('Первая задача')
      await newTodoInput.press('Enter')
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(1)

      await newTodoInput.fill('Вторая задача')
      await page.getByRole('button', { name: 'Добавить' }).click()
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(2)

      const secondCheckbox = page.locator('[data-todo-id]').nth(1).getByRole('checkbox')
      await secondCheckbox.focus()
      await page.keyboard.press('Space')
      await expect.poll(() => secondCheckbox.isChecked()).toBe(true)

      await saveButton.click()

      await expect.poll(() => new URL(page.url()).pathname !== '/notes/new').toBe(true)

      const savedPath = new URL(page.url()).pathname
      expect(savedPath).toMatch(/^\/notes\/[^/]+$/)

      await expect.poll(() => page.getByText('Заметка сохранена.').isVisible()).toBe(true)
      await expect.poll(() => page.getByText('Все изменения сохранены').isVisible()).toBe(true)

      await page.reload()

      await expect.poll(() => waitForHeading(page, 1)).toBe('Редактирование заметки')
      await expect.poll(() => titleInput.inputValue()).toBe('Моя заметка')
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(2)

      const reloadedSecond = page.locator('[data-todo-id]').nth(1).getByRole('checkbox')
      await expect.poll(() => reloadedSecond.isChecked()).toBe(true)

      const stored = await readStoredNotes(page)
      expect(stored).toHaveLength(1)
      expect(stored[0]?.title).toBe('Моя заметка')
      expect(stored[0]?.todos).toHaveLength(2)
    } finally {
      await page.close()
    }
  })

  it('edits the title and supports todo add, edit, toggle and remove', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [existingNote], `/notes/${existingNote.id}`)

      await expect.poll(() => waitForHeading(page, 1)).toBe('Редактирование заметки')

      const titleInput = page.getByLabel('Название')
      const todoItem = page.locator(`[data-todo-id="${existingNote.todos[0]!.id}"]`)
      const todoInput = todoItem.getByLabel('Текст задачи')
      const todoCheckbox = todoItem.getByRole('checkbox')
      const newTodoInput = page.getByLabel('Новая задача')

      await expect.poll(() => titleInput.inputValue()).toBe('Старая заметка')

      await todoInput.fill('   ')
      await todoInput.press('Tab')
      await expect.poll(() => todoInput.inputValue()).toBe('Старая задача')

      await titleInput.fill('Обновлённая заметка')
      await todoInput.fill('Обновлённая задача')
      await todoInput.press('Tab')

      await todoCheckbox.focus()
      await page.keyboard.press('Space')
      await expect.poll(() => todoCheckbox.isChecked()).toBe(true)

      await newTodoInput.fill('Временная задача')
      await newTodoInput.press('Enter')
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(2)

      await page
        .locator('[data-todo-id]')
        .last()
        .getByRole('button', { name: /Удалить задачу/ })
        .click()
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(1)

      await page.getByRole('button', { name: 'Сохранить' }).click()
      await expect.poll(() => page.getByText('Заметка сохранена.').isVisible()).toBe(true)

      await page.reload()

      await expect.poll(() => titleInput.inputValue()).toBe('Обновлённая заметка')
      await expect.poll(() => todoInput.inputValue()).toBe('Обновлённая задача')
      await expect.poll(() => todoCheckbox.isChecked()).toBe(true)
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(1)
    } finally {
      await page.close()
    }
  })

  it('shows inline errors for empty title and todo', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [], '/notes/new')

      const titleInput = page.getByLabel('Название')
      const newTodoInput = page.getByLabel('Новая задача')
      const saveButton = page.getByRole('button', { name: 'Сохранить' })

      await titleInput.fill('   ')
      await expect.poll(() => page.getByText('Введите название').isVisible()).toBe(true)
      await expect.poll(() => saveButton.isDisabled()).toBe(true)

      await titleInput.fill('Заметка без задач')
      await newTodoInput.press('Enter')

      await expect.poll(() => page.getByText('Введите текст задачи').isVisible()).toBe(true)
      await expect
        .poll(() => page.getByRole('button', { name: 'Добавить' }).isDisabled())
        .toBe(true)
      await expect.poll(() => saveButton.isDisabled()).toBe(false)
    } finally {
      await page.close()
    }
  })

  it('asks for confirmation before cancelling edits', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [existingNote], `/notes/${existingNote.id}`)

      const titleInput = page.getByLabel('Название')
      const dialog = page.getByRole('alertdialog')

      await titleInput.fill('Несохранённая заметка')
      await page.getByRole('button', { name: 'Отменить', exact: true }).click()

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await expect
        .poll(() =>
          dialog
            .getByRole('button', { name: 'Продолжить редактирование' })
            .evaluate((element) => element === document.activeElement)
        )
        .toBe(true)

      await page.keyboard.press('Escape')
      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => titleInput.inputValue()).toBe('Несохранённая заметка')

      await page.getByRole('button', { name: 'Отменить', exact: true }).click()
      await expect.poll(() => dialog.isVisible()).toBe(true)
      await dialog.getByRole('button', { name: 'Отменить изменения' }).click()

      await expect.poll(() => new URL(page.url()).pathname).toBe('/')

      const stored = await readStoredNotes(page)
      expect(stored[0]?.title).toBe('Старая заметка')
    } finally {
      await page.close()
    }
  })

  it('deletes the note after confirmation', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [deletableNote], `/notes/${deletableNote.id}`)

      const dialog = page.getByRole('alertdialog')

      await page.getByRole('button', { name: 'Удалить', exact: true }).click()
      await expect.poll(() => dialog.isVisible()).toBe(true)

      await dialog.getByRole('button', { name: 'Удалить' }).click()

      await expect.poll(() => new URL(page.url()).pathname).toBe('/')
      await expect
        .poll(() => page.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)

      const stored = await readStoredNotes(page)
      expect(stored).toEqual([])
    } finally {
      await page.close()
    }
  })

  it('shows a not found state for an unknown note', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page, [], '/notes/unknown-note')

      await expect
        .poll(() => page.getByRole('heading', { level: 1, name: 'Заметка не найдена' }).isVisible())
        .toBe(true)
      await expect.poll(() => page.getByLabel('Название').count()).toBe(0)

      await page.getByRole('link', { name: 'Вернуться на главную' }).click()

      await expect.poll(() => new URL(page.url()).pathname).toBe('/')
    } finally {
      await page.close()
    }
  })

  it('shows a warning when writing notes to localStorage fails', async () => {
    const page = await browser.newPage()

    try {
      await page.addInitScript(() => {
        const originalSetItem = Storage.prototype.setItem

        Storage.prototype.setItem = function (key: string, value: string) {
          if (key === 'notes-app:data') {
            throw new Error('Quota exceeded')
          }

          originalSetItem.call(this, key, value)
        }
      })

      await page.goto(`${baseUrl}/notes/new`)

      await page.getByLabel('Название').fill('Без места')
      await page.getByLabel('Новая задача').fill('Задача')
      await page.getByLabel('Новая задача').press('Enter')
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

      await expect
        .poll(() => page.getByText('Не удалось сохранить заметки в браузере.').isVisible())
        .toBe(true)
      await expect.poll(() => page.getByLabel('Название').inputValue()).toBe('Без места')
    } finally {
      await page.close()
    }
  })
})
