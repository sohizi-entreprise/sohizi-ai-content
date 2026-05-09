import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import type { PlayerRef } from '@remotion/player'

type PlayerRefHolder = { current: PlayerRef | null }

const PlayerRefContext = createContext<PlayerRefHolder | null>(null)

export function PlayerRefProvider({ children }: { children: ReactNode }) {
  const ref = useRef<PlayerRef | null>(null)
  return (
    <PlayerRefContext.Provider value={ref}>
      {children}
    </PlayerRefContext.Provider>
  )
}

export function usePlayerRef(): PlayerRefHolder {
  const ctx = useContext(PlayerRefContext)
  if (!ctx) {
    throw new Error('usePlayerRef must be used inside PlayerRefProvider')
  }
  return ctx
}
