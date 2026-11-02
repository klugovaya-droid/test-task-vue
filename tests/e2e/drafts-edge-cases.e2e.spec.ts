import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import type { Note, NotesPayload } from '../../app/types/notes'

const draftKey = 'notes-app:draft:v1:new'

const sharedNote: Note = {
  id: 'note-tab',
  title: 'Заметка для вкладок',
  todos: [{ id: 'todo-tab', text: 'Задача', done: false }],
  createdAt: 1_000,
  updatedAt: 2_000
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

function createPayload(notes: Note[]): NotesPayload {
  return {
    version: 1,
    notes
  }
}

async function openNewNote(page: Page): Promise<void> {
  await page.addInitScript((data: NotesPayload) => {
    if (!localStorage.getItem('notes-app:data')) {
      localStorage.setItem('notes-app:data', JSON.stringify(data))
    }
  }, createPayload([]))

  await page.goto(`${baseUrl}/notes/new`)

  await expect
    .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
    .toBe('Новая заметка')
}

async function waitForDraft(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((key: string) => localStorage.getItem(key) !== null, draftKey)
    )
    .toBe(true)
}

async function fillDraft(page: Page, title: string): Promise<void> {
  await page.getByLabel('Название').fill(title)
  await waitForDraft(page)
}

function recoveryDialog(page: Page) {
  return page.getByRole('alertdialog', { name: 'Восстановить черновик?' })
}

describe('draft recovery', () => {
  it('offers a draft after reload and restores it', async () => {
    const page = await browser.newPage()

    try {
      await openNewNote(page)

      const titleInput = page.getByLabel('Название')
      const newTodoInput = page.getByLabel('Новая задача')

      await titleInput.fill('Черновик заголовка')
      await newTodoInput.fill('Задача из черновика')
      await newTodoInput.press('Enter')
      await waitForDraft(page)

      await page.reload()

      const dialog = recoveryDialog(page)

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await expect
        .poll(() =>
          dialog
            .getByRole('button', { name: 'Восстановить' })
            .evaluate((element) => element === document.activeElement)
        )
        .toBe(true)

      await dialog.getByRole('button', { name: 'Восстановить' }).click()

      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => titleInput.inputValue()).toBe('Черновик заголовка')
      await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(1)
      await expect
        .poll(() =>
          page.locator('[data-todo-id]').first().getByLabel('Текст задачи').inputValue()
        )
        .toBe('Задача из черновика')
      await expect.poll(() => page.getByText('Не сохранено').isVisible()).toBe(true)
    } finally {
      await page.close()
    }
  })

  it('discards a draft without changing the saved version', async () => {
    const page = await browser.newPage()

    try {
      await openNewNote(page)
      await fillDraft(page, 'Черновик для удаления')

      await page.reload()

      const dialog = recoveryDialog(page)

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await dialog.getByRole('button', { name: 'Удалить черновик' }).click()

      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => page.getByLabel('Название').inputValue()).toBe('')
      await expect
        .poll(() =>
          page.evaluate((key: string) => localStorage.getItem(key) === null, draftKey)
        )
        .toBe(true)
      await expect
        .poll(() => page.getByRole('button', { name: 'Сохранить' }).isDisabled())
        .toBe(true)
    } finally {
      await page.close()
    }
  })

  it('restores a draft on Escape', async () => {
    const page = await browser.newPage()

    try {
      await openNewNote(page)
      await fillDraft(page, 'Черновик по Escape')

      await page.reload()

      const dialog = recoveryDialog(page)

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await page.keyboard.press('Escape')

      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => page.getByLabel('Название').inputValue()).toBe(
        'Черновик по Escape'
      )
    } finally {
      await page.close()
    }
  })
})

describe('external deletion', () => {
  it('shows a banner and saves the working copy as a new note', async () => {
    const context = await browser.newContext()

    await context.addInitScript((data: NotesPayload) => {
      if (!localStorage.getItem('notes-app:data')) {
        localStorage.setItem('notes-app:data', JSON.stringify(data))
      }
    }, createPayload([sharedNote]))

    const editorPage = await context.newPage()
    const homePage = await context.newPage()

    try {
      await editorPage.goto(`${baseUrl}/notes/${sharedNote.id}`)

      await expect
        .poll(async () => (await editorPage.getByRole('heading', { level: 1 }).textContent())?.trim())
        .toBe('Редактирование заметки')

      const titleInput = editorPage.getByLabel('Название')
      const saveButton = editorPage.getByRole('button', { name: 'Сохранить', exact: true })

      await titleInput.fill('Рабочая копия')
      await titleInput.press('Tab')
      await expect.poll(() => saveButton.isDisabled()).toBe(false)

      await homePage.goto(baseUrl)

      const card = homePage.locator(`[data-note-id="${sharedNote.id}"]`)

      await expect.poll(() => card.isVisible()).toBe(true)
      await card
        .getByRole('button', { name: 'Удалить заметку Заметка для вкладок' })
        .click()

      const homeDialog = homePage.getByRole('alertdialog')

      await expect.poll(() => homeDialog.isVisible()).toBe(true)
      await homeDialog.getByRole('button', { name: 'Удалить' }).click()
      await expect
        .poll(() => homePage.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)

      await expect
        .poll(() => editorPage.getByText('Заметка удалена в другой вкладке.').isVisible())
        .toBe(true)
      await expect.poll(() => saveButton.isDisabled()).toBe(true)
      await expect
        .poll(() =>
          editorPage.getByRole('button', { name: 'Сохранить как новую' }).isVisible()
        )
        .toBe(true)

      await editorPage.getByRole('button', { name: 'Сохранить как новую' }).click()

      await expect
        .poll(() => new URL(editorPage.url()).pathname !== `/notes/${sharedNote.id}`)
        .toBe(true)
      await expect
        .poll(() => editorPage.getByText('Заметка сохранена как новая.').isVisible())
        .toBe(true)

      const stored = await editorPage.evaluate(() => {
        const payload = JSON.parse(localStorage.getItem('notes-app:data') ?? '{}') as NotesPayload

        return payload.notes ?? []
      })

      expect(stored).toHaveLength(1)
      expect(stored[0]?.id).not.toBe(sharedNote.id)
      expect(stored[0]?.title).toBe('Рабочая копия')
    } finally {
      await context.close()
    }
  })
})
