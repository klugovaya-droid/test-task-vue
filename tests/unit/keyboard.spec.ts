import { describe, expect, it } from 'vitest'
import {
  hasOpenModal,
  isEditableTarget,
  isRedoShortcut,
  isUndoShortcut
} from '~/utils/keyboard'

function createKeyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init)
}

describe('history shortcuts', () => {
  it('matches undo with Ctrl+Z or Cmd+Z', () => {
    expect(isUndoShortcut(createKeyEvent({ key: 'z', ctrlKey: true }))).toBe(true)
    expect(isUndoShortcut(createKeyEvent({ key: 'z', metaKey: true }))).toBe(true)
    expect(isUndoShortcut(createKeyEvent({ key: 'я', code: 'KeyZ', ctrlKey: true }))).toBe(true)
  })

  it('ignores shortcuts during IME composition', () => {
    expect(isUndoShortcut(createKeyEvent({ key: 'z', ctrlKey: true, isComposing: true }))).toBe(false)
    expect(
      isRedoShortcut(createKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true, isComposing: true }))
    ).toBe(false)
  })

  it('does not match undo with extra modifiers or without a modifier', () => {
    expect(isUndoShortcut(createKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isUndoShortcut(createKeyEvent({ key: 'z', ctrlKey: true, altKey: true }))).toBe(false)
    expect(isUndoShortcut(createKeyEvent({ key: 'z' }))).toBe(false)
    expect(isUndoShortcut(createKeyEvent({ key: 'y', ctrlKey: true }))).toBe(false)
  })

  it('matches redo with Ctrl+Shift+Z or Cmd+Shift+Z', () => {
    expect(isRedoShortcut(createKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(isRedoShortcut(createKeyEvent({ key: 'Z', metaKey: true, shiftKey: true }))).toBe(true)
  })

  it('does not match redo without shift or with alt', () => {
    expect(isRedoShortcut(createKeyEvent({ key: 'z', ctrlKey: true }))).toBe(false)
    expect(isRedoShortcut(createKeyEvent({ key: 'z', metaKey: true, shiftKey: true, altKey: true }))).toBe(
      false
    )
  })
})

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

    const submit = document.createElement('input')
    submit.type = 'submit'
    expect(isEditableTarget(submit)).toBe(false)

    const number = document.createElement('input')
    number.type = 'number'
    expect(isEditableTarget(number)).toBe(true)
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
