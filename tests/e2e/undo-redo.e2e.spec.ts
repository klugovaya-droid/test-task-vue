import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import type { Note, NotesPayload } from '../../app/types/notes'

const note: Note = {
  id: 'note-history',
  title: 'Исходная заметка',
  todos: [{ id: 'todo-1', text: 'Задача', done: false }],
  createdAt: 1_000,
  updatedAt: 2_000
}

const undoShortcut = process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z'
const redoShortcut = process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z'

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

async function openEditor(page: Page): Promise<void> {
  const payload: NotesPayload = {
    version: 1,
    notes: [note]
  }

  await page.addInitScript((data: NotesPayload) => {
    if (!localStorage.getItem('notes-app:data')) {
      localStorage.setItem('notes-app:data', JSON.stringify(data))
    }
  }, payload)

  await page.goto(`${baseUrl}/notes/${note.id}`)

  await expect
    .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
    .toBe('Редактирование заметки')
}

function historyButtons(page: Page) {
  return {
    undo: page.getByRole('button', { name: 'Отменить последнее действие' }),
    redo: page.getByRole('button', { name: 'Повторить действие' })
  }
}

describe('undo and redo', () => {
  it('undoes and redoes title and todo changes with toolbar buttons', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')
      const { undo, redo } = historyButtons(page)

      await expect.poll(() => undo.isDisabled()).toBe(true)
      await expect.poll(() => redo.isDisabled()).toBe(true)

      await titleInput.fill('Обновлённая')
      await titleInput.press('Tab')
      await expect.poll(() => undo.isDisabled()).toBe(false)

      await undo.click()
      await expect.poll(() => titleInput.inputValue()).toBe('Исходная заметка')
      await expect.poll(() => redo.isDisabled()).toBe(false)

      await redo.click()
      await expect.poll(() => titleInput.inputValue()).toBe('Обновлённая')

      const checkbox = page.locator('[data-todo-id="todo-1"]').getByRole('checkbox')
      await checkbox.focus()
      await page.keyboard.press('Space')
      await expect.poll(() => checkbox.isChecked()).toBe(true)

      await undo.click()
      await expect.poll(() => checkbox.isChecked()).toBe(false)

      await redo.click()
      await expect.poll(() => checkbox.isChecked()).toBe(true)
    } finally {
      await page.close()
    }
  })

  it('handles global undo and redo shortcuts outside text fields', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')

      await titleInput.fill('Новая')
      await titleInput.press('Tab')
      await page.getByRole('heading', { level: 1 }).click()

      await page.keyboard.press(undoShortcut)
      await expect.poll(() => titleInput.inputValue()).toBe('Исходная заметка')

      await page.keyboard.press(redoShortcut)
      await expect.poll(() => titleInput.inputValue()).toBe('Новая')
    } finally {
      await page.close()
    }
  })

  it('keeps undo available while a text input is focused', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')
      const { undo, redo } = historyButtons(page)

      await expect.poll(() => undo.isDisabled()).toBe(true)

      await titleInput.fill('Черновик')
      await expect.poll(() => undo.isDisabled()).toBe(false)

      await undo.click()
      await expect.poll(() => titleInput.inputValue()).toBe('Исходная заметка')
      await expect.poll(() => redo.isDisabled()).toBe(false)
    } finally {
      await page.close()
    }
  })

  it('clears the redo branch after a new change', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')
      const { undo, redo } = historyButtons(page)

      await titleInput.fill('Первый')
      await titleInput.press('Tab')
      await undo.click()
      await expect.poll(() => redo.isDisabled()).toBe(false)

      await titleInput.fill('Второй')
      await expect.poll(() => redo.isDisabled()).toBe(true)

      await titleInput.press('Tab')
      await expect.poll(() => redo.isDisabled()).toBe(true)

      await page.getByRole('heading', { level: 1 }).click()
      await page.keyboard.press(redoShortcut)
      await expect.poll(() => titleInput.inputValue()).toBe('Второй')
    } finally {
      await page.close()
    }
  })

  it('does not intercept native undo inside a text input', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')
      const { undo, redo } = historyButtons(page)

      await titleInput.focus()
      await page.keyboard.press('End')
      await titleInput.pressSequentially('!')
      await expect.poll(() => titleInput.inputValue()).toBe('Исходная заметка!')

      await page.keyboard.press(undoShortcut)
      await expect.poll(() => titleInput.inputValue()).toBe('Исходная заметка')
      await expect.poll(() => redo.isDisabled()).toBe(true)

      await titleInput.press('Tab')
      await expect.poll(() => undo.isDisabled()).toBe(true)
    } finally {
      await page.close()
    }
  })

  it('ignores history shortcuts while a modal is open', async () => {
    const page = await browser.newPage()

    try {
      await openEditor(page)

      const titleInput = page.getByLabel('Название')
      const dialog = page.getByRole('alertdialog')

      await titleInput.fill('Изменённая')
      await titleInput.press('Tab')
      await page.getByRole('button', { name: 'Удалить', exact: true }).click()
      await expect.poll(() => dialog.isVisible()).toBe(true)

      await page.keyboard.press(undoShortcut)
      await page.keyboard.press('Escape')
      await expect.poll(() => dialog.isVisible()).toBe(false)

      await expect.poll(() => titleInput.inputValue()).toBe('Изменённая')
    } finally {
      await page.close()
    }
  })
})
