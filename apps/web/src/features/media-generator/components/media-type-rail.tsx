import { GENERATION_TYPES } from "../constants"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { cn } from "@/lib/utils"

export function MediaTypeRail() {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const setGenerationType = useMediaGeneratorStore(
    (state) => state.setGenerationType,
  )

  return (
    <nav className="flex w-19 shrink-0 flex-col items-center gap-1 py-3">
      {GENERATION_TYPES.map((item) => {
        const Icon = item.icon
        const isActive = generationType === item.value

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setGenerationType(item.value)}
            className={cn(
              "relative flex flex-col w-16 items-center gap-1 rounded-xl px-1.5 py-2 text-center transition-colors text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center p-4 rounded-full",
                isActive && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
            </div>
            <span
              className={cn(
                "text-[10px] leading-tight font-medium",
                isActive && "text-primary",
              )}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
