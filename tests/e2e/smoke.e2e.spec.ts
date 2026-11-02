import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'

function resolveBaseUrl(): string {
  const fromEnv = process.env.E2E_BASE_URL

  if (!fromEnv) {
    throw new Error('E2E_BASE_URL is not set by global setup')
  }

  return fromEnv
}

let baseUrl = ''
let browser: Browser

beforeAll(async () => {
  baseUrl = resolveBaseUrl()
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser?.close()
})

describe('home page', () => {
  it('renders the app shell', async () => {
    const page = await browser.newPage()

    try {
      await page.goto(baseUrl)

      await expect
        .poll(async () => (await page.getByRole('heading', { level: 1 }).textContent())?.trim())
        .toBe('Заметки')

      await expect
        .poll(() => page.getByRole('heading', { name: 'Пока нет заметок' }).isVisible())
        .toBe(true)

      await expect
        .poll(() => page.getByRole('link', { name: 'Создать заметку' }).first().isVisible())
        .toBe(true)
    } finally {
      await page.close()
    }
  })
})
