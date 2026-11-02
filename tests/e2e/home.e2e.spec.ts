import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import type { Note, NotesPayload } from '../../app/types/notes'

const firstNote: Note = {
  id: 'note-1',
  title: 'Первая заметка',
  todos: [
    { id: 'todo-1', text: 'Первая', done: true },
    { id: 'todo-2', text: 'Вторая', done: false },
    { id: 'todo-3', text: 'Третья', done: false },
    { id: 'todo-4', text: 'Четвёртая', done: false }
  ],
  createdAt: 1_000,
  updatedAt: 2_000
}

const secondNote: Note = {
  id: 'note-2',
  title: 'Вторая заметка',
  todos: [{ id: 'todo-5', text: 'Одна задача', done: false }],
  createdAt: 3_000,
  updatedAt: 4_000
}

const singleNote: Note = {
  id: 'note-3',
  title: 'Единственная',
  todos: [{ id: 'todo-6', text: 'Не забыть', done: false }],
  createdAt: 5_000,
  updatedAt: 6_000
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

async function openHome(page: Page, notes: Note[] = []): Promise<void> {
  const payload: NotesPayload = {
    version: 1,
    notes
  }

  await page.addInitScript((data: NotesPayload) => {
    if (!localStorage.getItem('notes-app:data')) {
      localStorage.setItem('notes-app:data', JSON.stringify(data))
    }
  }, payload)

  await page.goto(baseUrl)

  await expect
    .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
    .toBe('Заметки')
}

async function openHomeWithNotes(notes: Note[]): Promise<Page> {
  const page = await browser.newPage()

  await openHome(page, notes)

  return page
}

describe('home page', () => {
  it('shows an empty state with a working create link', async () => {
    const page = await openHomeWithNotes([])

    try {
      await expect
        .poll(() => page.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)
      await expect
        .poll(() => page.getByText('Создайте первую заметку и добавьте к ней задачи.').isVisible())
        .toBe(true)

      await page.getByRole('link', { name: 'Создать заметку' }).first().click()

      await page.waitForURL('**/notes/new')
      expect(new URL(page.url()).pathname).toBe('/notes/new')
    } finally {
      await page.close()
    }
  })

  it('sorts cards, truncates todos and links to the editor', async () => {
    const page = await openHomeWithNotes([firstNote, secondNote])

    try {
      await expect.poll(() => page.locator('[data-note-id]').count()).toBe(2)

      const ids = await page
        .locator('[data-note-id]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-note-id')))

      expect(ids).toEqual([secondNote.id, firstNote.id])

      const card = page.locator(`[data-note-id="${firstNote.id}"]`)

      await expect
        .poll(() => card.getByRole('heading', { level: 2 }).textContent())
        .toBe('Первая заметка')
      await expect.poll(() => card.getByRole('checkbox').count()).toBe(3)
      await expect
        .poll(() => card.getByRole('checkbox', { name: 'Первая' }).isDisabled())
        .toBe(true)
      await expect.poll(() => card.getByText('Четвёртая').isVisible()).toBe(false)
      await expect.poll(() => card.getByText('+1 ещё').isVisible()).toBe(true)
      await expect.poll(() => card.getByText('Выполнено 1 из 4').isVisible()).toBe(true)

      await card.getByRole('link', { name: 'Редактировать заметку Первая заметка' }).click()

      await page.waitForURL(`**/notes/${firstNote.id}`)
      expect(new URL(page.url()).pathname).toBe(`/notes/${firstNote.id}`)
    } finally {
      await page.close()
    }
  })

  it('confirms deletion through an accessible modal', async () => {
    const page = await openHomeWithNotes([singleNote])

    try {
      const card = page.locator(`[data-note-id="${singleNote.id}"]`)
      const deleteButton = card.getByRole('button', { name: 'Удалить заметку Единственная' })
      const dialog = page.getByRole('alertdialog')
      const cancelButton = dialog.getByRole('button', { name: 'Отмена' })

      await deleteButton.focus()
      await page.keyboard.press('Enter')

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await expect
        .poll(async () => cancelButton.evaluate((element) => element === document.activeElement))
        .toBe(true)

      for (let index = 0; index < 5; index += 1) {
        await page.keyboard.press('Tab')
        await expect
          .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="alertdialog"]'))))
          .toBe(true)
      }

      await page.keyboard.press('Escape')

      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => card.isVisible()).toBe(true)
      await expect
        .poll(async () => deleteButton.evaluate((element) => element === document.activeElement))
        .toBe(true)

      await page.keyboard.press('Enter')
      await expect.poll(() => dialog.isVisible()).toBe(true)

      await cancelButton.click()
      await expect.poll(() => dialog.isVisible()).toBe(false)
      await expect.poll(() => card.isVisible()).toBe(true)

      await deleteButton.focus()
      await page.keyboard.press('Enter')
      await expect.poll(() => dialog.isVisible()).toBe(true)

      await dialog.getByRole('button', { name: 'Удалить' }).click()

      await expect.poll(() => page.locator(`[data-note-id="${singleNote.id}"]`).count()).toBe(0)
      await expect
        .poll(() => page.getByText('Заметка «Единственная» удалена.').isVisible())
        .toBe(true)

      const stored = await page.evaluate(
        () => JSON.parse(localStorage.getItem('notes-app:data') ?? '{}') as { notes?: unknown[] }
      )

      expect(stored.notes).toEqual([])
    } finally {
      await page.close()
    }
  })

  it('keeps a backup and shows a notice for corrupt storage', async () => {
    const page = await browser.newPage()
    const raw = '{"version":1,"notes":['

    try {
      await page.addInitScript((value: string) => {
        localStorage.setItem('notes-app:data', value)
      }, raw)
      await page.goto(baseUrl)

      await expect
        .poll(() =>
          page
            .getByText('Сохранённые заметки повреждены. Открыт пустой список.')
            .isVisible()
        )
        .toBe(true)
      await expect
        .poll(() => page.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('notes-app:backup')))
        .toBe(raw)
    } finally {
      await page.close()
    }
  })
})
