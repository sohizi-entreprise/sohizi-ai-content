import { useEffect } from "react"
import { WifiOff } from "lucide-react"
import { toast } from "sonner"
import { useOnlineStatus } from "@/hooks/use-online-status"

export const OFFLINE_TOAST_ID = "offline-status-banner"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (!isOnline) {
      toast.error("No internet connection", {
        id: OFFLINE_TOAST_ID,
        position: "top-center",
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
        icon: <WifiOff className="size-4 text-destructive" />,
      })
    } else {
      toast.dismiss(OFFLINE_TOAST_ID)
    }
  }, [isOnline])

  return null
}
