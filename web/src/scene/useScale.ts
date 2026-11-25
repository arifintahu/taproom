import { useEffect, useRef, useState } from 'react'

/** Scale factor for a pixel scene from the viewport width and the scroll container's width. */
export function useScale(scale: (viewport: number, container: number) => number, initial = 2) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setK(scale(window.innerWidth, el.clientWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [scale])
  return [ref, k] as const
}

/** Logical-pixel rect to CSS at scale k. */
export const px = (k: number) => (x: number, y: number, w: number, h: number) => ({ left: x * k, top: y * k, width: w * k, height: h * k })

/** True while a signature moment is fresh (the class is applied once, then dropped). */
export const recent = (anim: Record<string, number>, wall: number, key: string, ms = 1200) => !!anim[key] && wall - anim[key] < ms
