import { ColibriMascot } from "@sohizi/ui/colibri-mascot"
import {
  GREETINGS,
  SUGGESTIONS,
  getFirstName,
} from "../constants/empty-state-content"
import { useFillChatInput } from "../hooks/use-fill-chat-input"
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
  const fillChatInput = useFillChatInput()

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

        <div className="flex w-full max-w-md flex-col gap-2">
          {SUGGESTIONS.map((suggestion) => {
            const Icon = suggestion.icon
            return (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => fillChatInput(suggestion)}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-lg border border-white/10 bg-surface/60 px-3 py-2.5 text-left transition-colors",
                  "hover:border-white/20 hover:bg-surface",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <div className="flex w-full items-center gap-2.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-muted-foreground transition-colors group-hover:bg-white/10 group-hover:text-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 line-clamp-2 text-xs font-medium text-foreground">
                    {suggestion.title}
                  </div>
                  <span className="inline-flex shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 ring-1 ring-white/10">
                    /{suggestion.command.display}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {suggestion.description}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
