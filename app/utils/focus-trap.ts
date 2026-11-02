export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

let scrollLockCount = 0
let previousOverflow = ''

export function getFocusableElements(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => isAvailable(element, container)
  )
}

export function getNextFocusTarget(
  container: ParentNode,
  activeElement: Element | null,
  backwards = false
): HTMLElement | null {
  const elements = getFocusableElements(container)

  if (elements.length === 0) {
    return null
  }

  const activeIndex = activeElement instanceof HTMLElement ? elements.indexOf(activeElement) : -1

  if (backwards) {
    return activeIndex <= 0 ? elements[elements.length - 1]! : elements[activeIndex - 1]!
  }

  if (activeIndex === -1 || activeIndex === elements.length - 1) {
    return elements[0]!
  }

  return elements[activeIndex + 1]!
}

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (scrollLockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  scrollLockCount += 1
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || scrollLockCount === 0) {
    return
  }

  scrollLockCount -= 1

  if (scrollLockCount === 0) {
    document.body.style.overflow = previousOverflow
  }
}

function isAvailable(element: HTMLElement, container: ParentNode): boolean {
  if (element.getAttribute('tabindex') === '-1') {
    return false
  }

  let node: HTMLElement | null = element
  const boundary = container instanceof HTMLElement ? container : null

  while (node) {
    if (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) {
      return false
    }

    if (node === boundary) {
      break
    }

    node = node.parentElement
  }

  return true
}
