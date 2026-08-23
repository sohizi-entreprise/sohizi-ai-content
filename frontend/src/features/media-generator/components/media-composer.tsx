import { getGeneratorTitle } from '../constants'
import { useModelParameters, useValidateParameterValues } from '../hooks/use-model-parameters'
import { useSendRequest } from '../hooks/use-send-request'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { MediaChatInput } from './media-chat-input'
import { MediaModelSettings } from './media-model-settings'
import { MediaSubtypeTabs } from './media-subtype-tabs'
import { MediaTypeRail } from './media-type-rail'
import { toast } from 'sonner'

export default function MediaComposer({ projectId }: { projectId: string }) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
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


function SettingsAndInput({ projectId }: { projectId: string }){
  const { sendRequest, isPending, disableButton } = useSendRequest(projectId)
  const { parameters, isLoadingParameters } = useModelParameters()
  const { validate, errors, resetErrors } = useValidateParameterValues()
  
  const handleSendRequest = async () => {
    const isValid = validate(parameters)
    if (!isValid) {
      toast.error('Please fill the required fields in the settings')
      return
    }
    await sendRequest(parameters)
  }

  return (
    <div className='flex flex-col flex-1 min-h-0'>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <MediaModelSettings projectId={projectId}
                            errors={errors}
                            isLoadingParameters={isLoadingParameters}
                            parameters={parameters}
                            resetErrors={resetErrors}
        />
      </div>

      <div className="shrink-0 px-3 pb-3">
        <MediaChatInput projectId={projectId}
                        handleSendRequest={handleSendRequest}
                        isPending={isPending}
                        disableButton={disableButton}
        />
      </div>
    </div>
  )
}
