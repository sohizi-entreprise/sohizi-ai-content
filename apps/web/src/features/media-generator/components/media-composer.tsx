import { toast } from "sonner"
import { getGeneratorTitle } from "../constants"
import { useGenerationCredits } from "../hooks/use-generation-credits"
import {
  useModelParameters,
  useValidateParameterValues,
} from "../hooks/use-model-parameters"
import { useSendRequest } from "../hooks/use-send-request"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { MediaChatInput } from "./media-chat-input"
import { MediaModelSettings } from "./media-model-settings"
import { MediaSubtypeTabs } from "./media-subtype-tabs"
import { MediaTypeRail } from "./media-type-rail"

export default function MediaComposer({ projectId }: { projectId: string }) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col bg-card rounded-2xl">
        <header className="shrink-0 space-y-3 px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {getGeneratorTitle(generationType)}
          </h2>
          <MediaSubtypeTabs />
        </header>

        <SettingsAndInput projectId={projectId} />
      </div>

      <MediaTypeRail />
    </div>
  )
}

function SettingsAndInput({ projectId }: { projectId: string }) {
  const { sendRequest, isPending } = useSendRequest(projectId)
  const { parameters, isLoadingParameters } = useModelParameters()
  const { credits } = useGenerationCredits(projectId, parameters)
  const { validate, errors, resetErrors } = useValidateParameterValues()
  const parameterValues = useMediaGeneratorStore(
    (state) => state.parameterValues,
  )

  const settingsParameters = parameters.filter(
    (parameter) => parameter.key !== "prompt",
  )
  const promptParameter = parameters.find(
    (parameter) => parameter.key === "prompt",
  )
  const promptValue = parameterValues.prompt || ""
  const disableButton =
    isPending || Boolean(promptParameter?.required && !promptValue)

  const handleSendRequest = async () => {
    const isValid = validate(parameters)
    if (!isValid) {
      toast.error("Please fill the required fields in the settings")
      return
    }
    await sendRequest(parameters)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <MediaModelSettings
          projectId={projectId}
          errors={errors}
          isLoadingParameters={isLoadingParameters}
          parameters={settingsParameters}
          resetErrors={resetErrors}
        />
      </div>

      <div className="shrink-0 px-3 pb-3">
        <MediaChatInput
          projectId={projectId}
          promptParameter={promptParameter}
          error={promptParameter ? errors.prompt : undefined}
          resetErrors={resetErrors}
          handleSendRequest={handleSendRequest}
          isPending={isPending}
          disableButton={disableButton}
          credits={credits}
        />
      </div>
    </div>
  )
}
