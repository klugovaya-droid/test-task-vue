import { describe, expect, it } from 'vitest'
import { hasOpenModal, isEditableTarget } from '~/utils/keyboard'

describe('isEditableTarget', () => {
  it('detects text inputs, textareas and selects', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
  })

  it('detects contenteditable elements', () => {
    const element = document.createElement('div')

    element.setAttribute('contenteditable', 'true')
    expect(isEditableTarget(element)).toBe(true)

    element.setAttribute('contenteditable', '')
    expect(isEditableTarget(element)).toBe(true)

    element.setAttribute('contenteditable', 'false')
    expect(isEditableTarget(element)).toBe(false)
  })

  it('does not treat buttons and non-text inputs as editable', () => {
    expect(isEditableTarget(document.createElement('button'))).toBe(false)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    expect(isEditableTarget(checkbox)).toBe(false)
  })

  it('ignores non-element targets', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget(new EventTarget())).toBe(false)
  })
})

describe('hasOpenModal', () => {
  it('finds open dialog and alertdialog elements', () => {
    const container = document.createElement('div')

    expect(hasOpenModal(container)).toBe(false)

    container.innerHTML = '<div role="dialog" aria-modal="true"></div>'
    expect(hasOpenModal(container)).toBe(true)

    container.innerHTML = '<div role="alertdialog" aria-modal="true"></div>'
    expect(hasOpenModal(container)).toBe(true)
  })

  it('requires aria-modal', () => {
    const container = document.createElement('div')

    container.innerHTML = '<div role="dialog"></div>'

    expect(hasOpenModal(container)).toBe(false)
  })
})
