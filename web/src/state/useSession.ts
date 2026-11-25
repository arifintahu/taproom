import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Session, State } from './session'

export const SessionContext = createContext<Session | null>(null)

export function useSession(): [State, Session] {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside SessionProvider')
  const state = useSyncExternalStore(session.subscribe, session.getState)
  return [state, session]
}
