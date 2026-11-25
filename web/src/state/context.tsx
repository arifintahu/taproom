import type { ReactNode } from 'react'
import type { Session } from './session'
import { SessionContext } from './useSession'

export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
