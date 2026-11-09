import { ColibriMascot } from "@sohizi/ui/colibri-mascot"
import { GREETINGS, getFirstName } from "../constants/empty-state-content"
import { useStableRandom } from "../hooks/use-stable-random"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type ChatEmptyStateProps = {
  conversationKey: string
  className?: string
}

export function ChatEmptyState({
  conversationKey,
  className,
}: ChatEmptyStateProps) {
  const { data: session } = useSession()
  const firstName = getFirstName(session?.user.name)
  const buildGreeting = useStableRandom(
    GREETINGS,
    conversationKey,
    "chat-greeting",
  )

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="text-muted-foreground">
            <ColibriMascot state="processing" size={60} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-medium text-foreground">
              {buildGreeting(firstName)}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}
