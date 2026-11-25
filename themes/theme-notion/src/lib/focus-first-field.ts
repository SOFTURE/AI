// The form controls a dialog or sheet focuses on open, ahead of any button before them (a tooltip trigger beside a
// label opens its tooltip on focus, #1476).
const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not(:disabled)',
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[role="combobox"]:not(:disabled):not([aria-disabled="true"])',
].join(", ")

function findFirstField(container: Element): HTMLElement | null {
  for (const candidate of container.querySelectorAll<HTMLElement>(FIELD_SELECTOR)) {
    if (candidate.closest("[hidden], [inert]") === null) return candidate
  }
  return null
}

function focusField(field: HTMLElement): void {
  field.focus({ preventScroll: true })
  // Selected as Radix selects the first text input it focuses.
  if (field instanceof HTMLInputElement && document.activeElement === field) field.select()
}

/**
 * An `onOpenAutoFocus` handler for a Radix dialog or sheet content: it runs the app's own handler first, then, unless
 * that prevented the default, focuses the first form field inside the content instead of the first focusable element.
 * With no field, Radix's default focus stays.
 */
export function withFirstFieldFocus(
  onOpenAutoFocus: ((event: Event) => void) | undefined
): (event: Event) => void {
  return (event) => {
    onOpenAutoFocus?.(event)
    if (event.defaultPrevented || !(event.currentTarget instanceof Element)) return
    const field = findFirstField(event.currentTarget)
    if (field === null) return
    event.preventDefault()
    focusField(field)
  }
}
