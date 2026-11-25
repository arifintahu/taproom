import { createContext } from 'react'

/** Dev mode's simulated device width in CSS px; null means the real window. */
export const ViewportContext = createContext<number | null>(null)
