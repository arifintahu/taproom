import { useId, useRef, type ReactNode } from 'react'

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; the panel follows the selection. */
export function Tabs<T extends string>({ label, tabs, value, onChange, children }: {
  label: string
  tabs: [T, string][]
  value: T
  onChange: (v: T) => void
  children: ReactNode
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length
    onChange(tabs[n][0])
    refs.current[n]?.focus()
  }
  const cur = tabs.findIndex(([v]) => v === value)
  return (
    <>
      <div role="tablist" aria-label={label} className="tabs">
        {tabs.map(([v, text], i) => (
          <button
            key={v} ref={(el) => { refs.current[i] = el }} role="tab" type="button" id={`${id}-${v}`}
            className="pb sm" aria-selected={v === value} aria-controls={`${id}-panel`} tabIndex={v === value ? 0 : -1}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i + 1)
              else if (e.key === 'ArrowLeft') move(i - 1)
              else if (e.key === 'Home') move(0)
              else if (e.key === 'End') move(tabs.length - 1)
              else return
              e.preventDefault()
            }}
          >{text}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tabs[cur]?.[0]}`} className="tabpanel">{children}</div>
    </>
  )
}
