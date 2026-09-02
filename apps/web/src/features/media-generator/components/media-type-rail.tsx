import { GENERATION_TYPES } from "../constants"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { cn } from "@/lib/utils"

export function MediaTypeRail() {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const setGenerationType = useMediaGeneratorStore(
    (state) => state.setGenerationType,
  )

  return (
    <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-l py-3">
      {GENERATION_TYPES.map((item) => {
        const Icon = item.icon
        const isActive = generationType === item.value

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setGenerationType(item.value)}
            className={cn(
              "relative flex w-[68px] flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-center transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            {isActive ? (
              <span className="absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
            ) : null}
            <Icon className="size-4" />
            <span className="text-[10px] leading-tight font-medium">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
