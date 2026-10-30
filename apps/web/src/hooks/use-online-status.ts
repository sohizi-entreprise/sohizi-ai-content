import { useEffect, useSyncExternalStore } from "react"
import { onlineManager } from "@tanstack/react-query"

const subscribe = (onStoreChange: () => void) =>
  onlineManager.subscribe(onStoreChange)

const getSnapshot = () => onlineManager.isOnline()

const getServerSnapshot = () => true

export function useOnlineStatus(): boolean {
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.onLine === "boolean"
    ) {
      onlineManager.setOnline(navigator.onLine)
    }
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
