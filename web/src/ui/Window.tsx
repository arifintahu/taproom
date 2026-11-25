import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Open windows, oldest first: only the topmost one handles Escape and Tab (Confirm over Shop, for example). */
const stack: object[] = []

/**
 * Pixel window as a modal dialog: focus moves in, Tab stays inside, Escape closes,
 * and focus returns to the control that opened it.
 */
export function Window({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useRef(onClose)
  useLayoutEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = ref.current
    const token = {}
    stack.push(token)
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      stack.splice(stack.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`win dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="dialog-head">
          <h2 id={id} className="h dialog-title">{title}</h2>
          <button type="button" className="pb sm" onClick={onClose} aria-label={`Close ${title}`}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
