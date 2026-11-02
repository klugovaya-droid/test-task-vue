import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserType
} from 'playwright'
import type { NotesPayload } from '../../app/types/notes'

const browserTypes: Array<{ name: string; type: BrowserType }> = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit }
]

let baseUrl = ''

beforeAll(() => {
  const fromEnv = process.env.E2E_BASE_URL

  if (!fromEnv) {
    throw new Error('E2E_BASE_URL is not set by global setup')
  }

  baseUrl = fromEnv
})

for (const entry of browserTypes) {
  describe(entry.name, () => {
    let browser: Browser
    let firefoxHome: string | undefined

    beforeAll(async () => {
      if (entry.name === 'firefox') {
        // macOS 27 TCC blocks the bundled Firefox from the real Application Support directory.
        firefoxHome = await mkdtemp(join(tmpdir(), 'notes-firefox-home-'))
        browser = await entry.type.launch({
          env: {
            ...process.env,
            CFFIXED_USER_HOME: firefoxHome
          }
        })
        return
      }

      browser = await entry.type.launch()
    })

    afterAll(async () => {
      await browser?.close()

      if (firefoxHome) {
        // macOS TCC can deny deleting the fake home it protected during the run.
        await rm(firefoxHome, { recursive: true, force: true }).catch(() => undefined)
      }
    })

    it('creates a note and restores it after reload', async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      const payload: NotesPayload = {
        version: 1,
        notes: []
      }
      const pageErrors: string[] = []

      page.on('pageerror', (error) => {
        pageErrors.push(error.message)
      })

      try {
        await page.addInitScript((data: NotesPayload) => {
          if (!localStorage.getItem('notes-app:data')) {
            localStorage.setItem('notes-app:data', JSON.stringify(data))
          }
        }, payload)

        await page.goto(`${baseUrl}/notes/new`)

        await expect
          .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
          .toBe('Новая заметка')

        const titleInput = page.getByLabel('Название')
        const newTodoInput = page.getByLabel('Новая задача')
        const saveButton = page.getByRole('button', { name: 'Сохранить', exact: true })

        await titleInput.fill(`Заметка ${entry.name}`)
        await newTodoInput.fill('Кросс-браузерная задача')
        await newTodoInput.press('Enter')
        await saveButton.click()

        await expect
          .poll(() => new URL(page.url()).pathname !== '/notes/new')
          .toBe(true)
        await expect
          .poll(() => page.getByText('Заметка сохранена.').isVisible())
          .toBe(true)

        await page.reload()

        await expect
          .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
          .toBe('Редактирование заметки')
        await expect.poll(() => titleInput.inputValue()).toBe(`Заметка ${entry.name}`)
        await expect.poll(() => page.locator('[data-todo-id]').count()).toBe(1)
        expect(pageErrors).toEqual([])
      } finally {
        await page.close()
      }
    })
  })
}
