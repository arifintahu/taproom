import type { CSSProperties } from 'react'
import { avatarLayers } from '../game/avatar'
import type { Look } from '../game/constants'

/** A 48 x 48 gnome built from sprite-sheet layers, scaled to `size` CSS px. Decorative: the label lives on the control. */
export function Gnome({ addr, look, size }: { addr: string; look?: Look; size: number }) {
  const px = Math.round(size)
  const g = avatarLayers(addr, look)
  const style = {
    width: px, height: px,
    '--p': `${(px / 48).toFixed(2)}px`,
    animationDelay: `-${g.bobDelay}s`,
    animationDuration: `${g.bobDuration}s`,
  } as CSSProperties
  return (
    <span className="pg bob" style={style} aria-hidden="true">
      {g.layers.map((l) => (
        <span
          key={l.sheet}
          className={`pgl pg-${l.sheet}${l.sheet === 'blink' ? ' blink' : ''}`}
          style={{
            backgroundSize: `${l.frames * px}px ${px}px`,
            backgroundPosition: `-${l.frame * px}px 0`,
            ...(l.sheet === 'blink' ? { animationDelay: `-${g.blinkDelay}s`, animationDuration: `${g.blinkDuration}s` } : null),
          }}
        />
      ))}
    </span>
  )
}
