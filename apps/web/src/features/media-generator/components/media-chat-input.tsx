import { Button } from "@sohizi/ui/button"
import { IconSparklesFilled } from "@tabler/icons-react"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { ParameterField } from "./media-model-settings"
import type { ModelParameterBinding } from "@/features/admin/types"
import { cn } from "@/lib/utils"

export type MediaChatInputProps = {
  projectId: string
  promptParameter?: ModelParameterBinding
  error?: string
  resetErrors: () => void
  className?: string
  handleSendRequest: () => void
  isPending: boolean
  disableButton: boolean
  credits?: number | null
}

export function MediaChatInput({
  projectId,
  promptParameter,
  error,
  resetErrors,
  className,
  handleSendRequest,
  isPending,
  disableButton,
  credits,
}: MediaChatInputProps) {
  const parameterValues = useMediaGeneratorStore(
    (state) => state.parameterValues,
  )
  const updateParameterValue = useMediaGeneratorStore(
    (state) => state.updateParameterValue,
  )

  return (
    <section className={cn("relative", className)}>
      <div className="relative z-1">
        {promptParameter ? (
          <div className="py-2">
            <ParameterField
              projectId={projectId}
              parameter={promptParameter}
              value={
                parameterValues.prompt || promptParameter.defaultValue || ""
              }
              onChange={(value) => {
                updateParameterValue("prompt", value)
                resetErrors()
              }}
              error={error}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 py-2">
          <Button
            disabled={disableButton}
            onClick={handleSendRequest}
            className={cn(
              "h-11 w-full rounded-xl text-black font-semibold disabled:opacity-50",
              isPending && "animate-pulse",
            )}
          >
            <IconSparklesFilled className="size-6" />
            {isPending ? "Pending…" : "Generate"}
            {credits != null ? (
              <span className="tabular-nums opacity-80">
                &bull; {credits} {credits === 1 ? "credit" : "credits"}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </section>
  )
}
