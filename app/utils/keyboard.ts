const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
])

export function isUndoShortcut(event: KeyboardEvent): boolean {
  return (
    !event.isComposing &&
    isZKey(event) &&
    hasPrimaryModifier(event) &&
    !event.shiftKey &&
    !event.altKey
  )
}

export function isRedoShortcut(event: KeyboardEvent): boolean {
  return (
    !event.isComposing &&
    isZKey(event) &&
    hasPrimaryModifier(event) &&
    event.shiftKey &&
    !event.altKey
  )
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const editable = target.getAttribute('contenteditable')

  if (target.isContentEditable || editable === '' || editable === 'true' || editable === 'plaintext-only') {
    return true
  }

  const tag = target.tagName.toLowerCase()

  if (tag === 'textarea' || tag === 'select') {
    return true
  }

  if (tag === 'input') {
    return !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type)
  }

  return false
}

export function hasOpenModal(root?: ParentNode): boolean {
  const scope = root ?? (typeof document === 'undefined' ? null : document)

  if (!scope) {
    return false
  }

  return (
    scope.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]') !==
    null
  )
}

function isZKey(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'z' || event.code === 'KeyZ'
}

function hasPrimaryModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}
