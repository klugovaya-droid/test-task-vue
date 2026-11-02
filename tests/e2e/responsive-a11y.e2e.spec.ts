import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import type { Note, NotesPayload } from '../../app/types/notes'

const longTitle = 'Заметка'.repeat(17)
const longTodo = 'Задача'.repeat(30)

const responsiveNote: Note = {
  id: 'note-responsive',
  title: longTitle,
  todos: [
    { id: 'todo-long', text: longTodo, done: false },
    { id: 'todo-short', text: 'Короткая задача', done: true }
  ],
  createdAt: 1_000,
  updatedAt: 2_000
}

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 }
]

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

function payload(notes: Note[]): NotesPayload {
  return {
    version: 1,
    notes
  }
}

async function seed(page: Page, notes: Note[]): Promise<void> {
  await page.addInitScript((data: NotesPayload) => {
    if (!localStorage.getItem('notes-app:data')) {
      localStorage.setItem('notes-app:data', JSON.stringify(data))
    }
  }, payload(notes))
}

async function openHome(page: Page, notes: Note[] = []): Promise<void> {
  await seed(page, notes)
  await page.goto(baseUrl)

  await expect
    .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
    .toBe('Заметки')
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )
}

async function smallTouchTargets(page: Page): Promise<Array<{ text: string; width: number; height: number }>> {
  return page
    .locator('.app-button, .app-checkbox, .note-card__edit, .home__create')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element)

          return style.display !== 'none' && style.visibility !== 'hidden'
        })
        .map((element) => {
          const rect = element.getBoundingClientRect()

          return {
            text: element.textContent?.trim().slice(0, 40) ?? '',
            width: rect.width,
            height: rect.height
          }
        })
        .filter(
          (element) =>
            element.width > 0 &&
            element.height > 0 &&
            (element.width < 44 || element.height < 44)
        )
    )
}

describe('responsive layout', () => {
  it('fits home and editor at mobile, tablet and desktop sizes', async () => {
    for (const viewport of viewports) {
      const page = await browser.newPage()

      try {
        await page.setViewportSize(viewport)
        await openHome(page, [responsiveNote])

        const card = page.locator(`[data-note-id="${responsiveNote.id}"]`)

        await expect.poll(() => card.isVisible()).toBe(true)
        await expect.poll(() => noHorizontalOverflow(page)).toBe(true)
        expect(await smallTouchTargets(page)).toEqual([])

        await page.goto(`${baseUrl}/notes/${responsiveNote.id}`)

        await expect
          .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
          .toBe('Редактирование заметки')
        await expect.poll(() => noHorizontalOverflow(page)).toBe(true)
        expect(await smallTouchTargets(page)).toEqual([])
      } finally {
        await page.close()
      }
    }
  })
})

describe('accessibility', () => {
  it('links inline errors to inputs and announces save feedback', async () => {
    const page = await browser.newPage()

    try {
      await openHome(page, [])
      await page.goto(`${baseUrl}/notes/new`)

      const titleInput = page.getByLabel('Название')
      const newTodoInput = page.getByLabel('Новая задача')
      const saveButton = page.getByRole('button', { name: 'Сохранить', exact: true })

      await titleInput.fill('   ')

      await expect.poll(() => page.getByText('Введите название').isVisible()).toBe(true)
      await expect.poll(() => titleInput.getAttribute('aria-invalid')).toBe('true')

      const describedBy = await titleInput.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()

      const errorId = describedBy
        ?.split(' ')
        .find((id) => id.endsWith('-error'))

      if (!errorId) {
        throw new Error('Expected an error id in aria-describedby')
      }

      await expect
        .poll(async () => (await page.locator(`[id="${errorId}"]`).textContent())?.trim())
        .toBe('Введите название')

      await titleInput.fill('Доступная заметка')
      await newTodoInput.fill('Задача')
      await newTodoInput.press('Enter')
      await saveButton.click()

      await expect.poll(() => new URL(page.url()).pathname !== '/notes/new').toBe(true)

      const status = page.getByRole('status')

      await expect.poll(() => status.getAttribute('aria-live')).toBe('polite')
      await expect.poll(() => status.getByText('Заметка сохранена.').isVisible()).toBe(true)
    } finally {
      await page.close()
    }
  })

  it('exposes dialog semantics and focuses the safe action', async () => {
    const page = await browser.newPage()

    try {
      await openHome(page, [responsiveNote])

      await page
        .locator(`[data-note-id="${responsiveNote.id}"]`)
        .getByRole('button', { name: /Удалить заметку/ })
        .click()

      const dialog = page.getByRole('alertdialog')

      await expect.poll(() => dialog.isVisible()).toBe(true)
      await expect.poll(() => dialog.getAttribute('aria-modal')).toBe('true')

      const labelledBy = await dialog.getAttribute('aria-labelledby')
      const describedBy = await dialog.getAttribute('aria-describedby')

      if (!labelledBy || !describedBy) {
        throw new Error('Expected dialog labels to be connected')
      }

      await expect
        .poll(async () => (await page.locator(`[id="${labelledBy}"]`).textContent())?.trim())
        .toBe('Удалить заметку?')
      await expect
        .poll(async () =>
          (await page.locator(`[id="${describedBy}"]`).textContent())?.includes('будет удалена')
        )
        .toBe(true)

      await expect
        .poll(() =>
          dialog
            .getByRole('button', { name: 'Отмена' })
            .evaluate((element) => element === document.activeElement)
        )
        .toBe(true)
    } finally {
      await page.close()
    }
  })

  it('shows a visible focus outline for keyboard navigation', async () => {
    const page = await browser.newPage()

    try {
      await openHome(page, [responsiveNote])

      await page.keyboard.press('Tab')

      const skipLink = page.locator('.skip-link')
      await expect.poll(() => skipLink.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
        'solid'
      )

      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      const createLink = page.locator('.home__create').first()

      await expect
        .poll(async () => createLink.evaluate((element) => element === document.activeElement))
        .toBe(true)
      await expect
        .poll(() => createLink.evaluate((element) => getComputedStyle(element).outlineStyle))
        .toBe('solid')
    } finally {
      await page.close()
    }
  })

  it('respects reduced motion', async () => {
    const page = await browser.newPage()

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await openHome(page, [])

      const values = await page.evaluate(() => ({
        transition: getComputedStyle(document.documentElement)
          .getPropertyValue('--transition-fast')
          .trim(),
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
      }))

      expect(values.transition).toMatch(/^0m?s$/)
      expect(values.scrollBehavior).toBe('auto')
    } finally {
      await page.close()
    }
  })

  it('supports a keyboard-only create and delete flow', async () => {
    const page = await browser.newPage()

    try {
      await openHome(page, [])
      await page.goto(`${baseUrl}/notes/new`)

      const titleInput = page.getByLabel('Название')
      const newTodoInput = page.getByLabel('Новая задача')
      const saveButton = page.getByRole('button', { name: 'Сохранить', exact: true })

      await titleInput.focus()
      await page.keyboard.type('Клавиатурная заметка')

      await newTodoInput.focus()
      await page.keyboard.type('Сделать по клавиатуре')
      await page.keyboard.press('Enter')

      await saveButton.focus()
      await page.keyboard.press('Enter')

      await expect.poll(() => new URL(page.url()).pathname !== '/notes/new').toBe(true)

      await page.reload()
      await expect.poll(() => titleInput.inputValue()).toBe('Клавиатурная заметка')

      await page.goto(baseUrl)

      const card = page.locator('[data-note-id]').first()
      const deleteButton = card.getByRole('button', { name: /Удалить заметку/ })

      await deleteButton.focus()
      await page.keyboard.press('Enter')

      const dialog = page.getByRole('alertdialog')

      await expect.poll(() => dialog.isVisible()).toBe(true)

      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      await expect
        .poll(() => page.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)
    } finally {
      await page.close()
    }
  })
})
