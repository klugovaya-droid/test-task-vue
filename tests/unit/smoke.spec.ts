import { describe, expect, it } from 'vitest'
import { createId } from '~/utils/ids'

describe('createId', () => {
  it('creates a non-empty string', () => {
    const id = createId()

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('creates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()))

    expect(ids.size).toBe(100)
  })
})
