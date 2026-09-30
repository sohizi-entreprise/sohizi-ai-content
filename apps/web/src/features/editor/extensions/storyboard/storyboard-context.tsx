import { createContext, useContext } from "react"

export type StoryboardContextValue = {
  /** Open the shot detail sheet for the given (existing) shot id. */
  openShotSheet: (shotId: string) => void
  /**
   * Open the shot detail sheet in "create" mode for the given scene. The shot
   * is only inserted once the sheet is saved (cancelling adds nothing).
   */
  openNewShotSheet: (sceneId: string) => void
  /** Attach the storyboard file plus `scene N` to chat. */
  attachScene: (sceneNumber: number) => void
  /** Attach the storyboard file plus `scene N - shot N` to chat. */
  attachShot: (sceneNumber: number, shotNumber: number) => void
}

const StoryboardContext = createContext<StoryboardContextValue | null>(null)

export const StoryboardProvider = StoryboardContext.Provider

export function useStoryboardContext(): StoryboardContextValue {
  const value = useContext(StoryboardContext)
  if (!value) {
    throw new Error(
      "useStoryboardContext must be used within a StoryboardProvider",
    )
  }
  return value
}
