import { describe, expect, it } from 'vitest'
import {
  getFocusableElements,
  getNextFocusTarget,
  lockBodyScroll,
  unlockBodyScroll
} from '~/utils/focus-trap'

function createContainer(html: string): HTMLDivElement {
  const container = document.createElement('div')

  container.innerHTML = html

  return container
}

function byId(container: ParentNode, id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`#${id}`)

  if (!element) {
    throw new Error(`Missing element #${id}`)
  }

  return element
}

describe('getFocusableElements', () => {
  it('returns enabled focusable elements in DOM order', () => {
    const container = createContainer(`
      <button id="first">First</button>
      <button id="disabled" disabled>Disabled</button>
      <a id="link" href="#target">Link</a>
      <a id="anchor">No href</a>
      <input id="text" />
      <input id="hidden" type="hidden" />
      <input id="disabled-input" disabled />
      <div id="custom" tabindex="0">Custom</div>
      <div id="skipped" tabindex="-1">Skipped</div>
      <div aria-hidden="true"><button id="hidden-ancestor">Hidden</button></div>
      <div hidden><button id="hidden-attribute">Hidden attribute</button></div>
    `)

    expect(getFocusableElements(container).map((element) => element.id)).toEqual([
      'first',
      'link',
      'text',
      'custom'
    ])
  })

  it('returns an empty list for a container without focusable elements', () => {
    expect(getFocusableElements(createContainer('<p>Text</p>'))).toEqual([])
  })
})

describe('getNextFocusTarget', () => {
  const container = createContainer(`
    <button id="first">First</button>
    <a id="second" href="#target">Second</a>
    <input id="third" />
  `)

  it('moves forward and wraps to the first element', () => {
    expect(getNextFocusTarget(container, byId(container, 'first'))?.id).toBe('second')
    expect(getNextFocusTarget(container, byId(container, 'third'))?.id).toBe('first')
  })

  it('moves backward and wraps to the last element', () => {
    expect(getNextFocusTarget(container, byId(container, 'second'), true)?.id).toBe('first')
    expect(getNextFocusTarget(container, byId(container, 'first'), true)?.id).toBe('third')
  })

  it('starts from the edges when focus is outside the container', () => {
    expect(getNextFocusTarget(container, null)?.id).toBe('first')
    expect(getNextFocusTarget(container, document.body, true)?.id).toBe('third')
  })

  it('returns null when there is nothing to focus', () => {
    expect(getNextFocusTarget(createContainer('<p>Text</p>'), null)).toBeNull()
  })

  it('keeps focus on a single element in both directions', () => {
    const single = createContainer('<button id="only">Only</button>')
    const only = byId(single, 'only')

    expect(getNextFocusTarget(single, only)?.id).toBe('only')
    expect(getNextFocusTarget(single, only, true)?.id).toBe('only')
  })
})

describe('body scroll lock', () => {
  it('locks and restores overflow for nested locks', () => {
    document.body.style.overflow = 'scroll'

    lockBodyScroll()
    expect(document.body.style.overflow).toBe('hidden')

    lockBodyScroll()
    unlockBodyScroll()
    expect(document.body.style.overflow).toBe('hidden')

    unlockBodyScroll()
    expect(document.body.style.overflow).toBe('scroll')

    document.body.style.overflow = ''
  })
})
