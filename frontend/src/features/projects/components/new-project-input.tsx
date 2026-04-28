
import { Button } from "@/components/ui/button"
import DropMenuSettings, { DropMenuOption } from "./drop-menu-settings"
import { ChevronDown, Clock, Sparkles } from "lucide-react"
import { IconArrowNarrowUp, IconPlus } from "@tabler/icons-react"
import NewProjectSettings from "./new-project-settings"
import { useNewProjectStore } from "../store/new-project-store"
import { toast } from "sonner"
import { createProjectSchema } from "../schema"
import { createProjectMutationOptions } from "../query-mutation"
import { useMutation } from "@tanstack/react-query"
import { DotsLoader } from "@/components/ui/loaders"
import { useNavigate } from "@tanstack/react-router"

export default function NewProjectInput() {
    const { 
        storyIdea, 
        setStoryIdea,
        additionalSettings,
        format,
        duration,
        validate,
        modelId
    } = useNewProjectStore()

    const { mutate: createProject, isPending } = useMutation(createProjectMutationOptions)
    const navigate = useNavigate()

    const onSubmit = () => {
        const { valid, errors } = validate()
        if (!valid) {
            errors.forEach((error) => {
                toast.error(error)
            })
            return
        }
        const payload = {
            brief: {
                format,
                durationMin: duration,
                storyIdea,
            },
            additionalSettings,
            modelId
        }
        const output = createProjectSchema.safeParse(payload)
        if (!output.success) {
            let errorMessage = ''
            for (const [_, value] of Object.entries(output.error.issues)) {
                errorMessage += value.path.join('.') + ': ' + value.message + '\n\n'
            }
            toast.error(errorMessage)
            return
        }   
        
        createProject(output.data, {
            onSuccess: async(response) => {
                await navigate({
                    to: '/dashboard/projects/$projectId/editor',
                    params: {
                        projectId: response.id,
                    },
                })
            }
        })
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
        }
    }
    
  return (
    <div className='border-white/10 border rounded-xl p-4 h-fit bg-white/5'>
        <div></div>
        <textarea 
          placeholder='Type your story idea here...' 
          className='w-full min-h-[60px] max-h-[180px] resize-none field-sizing-content bg-transparent border-none outline-none focus:ring-0 focus:ring-offset-0'
          value={storyIdea}
          onChange={(e) => setStoryIdea(e.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
                <AddAttachment />
                <SelectDuration />
                <NewProjectSettings />
            </div>

            <div className='flex items-center gap-2'>
                <SelectModel />
                <Button variant="outline" 
                        size="icon" 
                        className="size-8 dark:bg-white/10 rounded-full"
                        onClick={onSubmit}
                        disabled={!storyIdea.trim()}
            >
                    <IconArrowNarrowUp className="size-4" />
                </Button>

            </div>

        </div>

        <LoaderOverlay isLoading={isPending} />
    </div>
  )
}

const models: DropMenuOption[] = [
    {label: 'GPT 5.1', value: 'gpt-5.1'},
    {label: 'GPT 5.1 nano', value: 'gpt-5.1-nano',}
]

function SelectModel(){
    const { modelId, setModelId } = useNewProjectStore()
    const model = modelId || models[0].value
    const modelLable = models.find((m) => m.value === model)?.label || ''
    return (
        <DropMenuSettings options={models} onSelect={(val) => setModelId(val)} align="end">
            <div className="flex items-center gap-2 p-2 rounded-lg">
                <Sparkles className="size-4" />
                <div className="text-sm font-medium">{modelLable}</div>
                <ChevronDown className="size-4" />
            </div>
        </DropMenuSettings>
    )
}

const durations: DropMenuOption[] = [
    {label: '< 2 mins', value: '> 2'},
    {label: '2-5 mins', value: '2-5'},
    {label: '5-10 mins', value: '5-10'},
    {label: '10-15 mins', value: '10-15'},
    {label: '15-20 mins', value: '15-20'},
    {label: '20-25 mins', value: '20-25'},
    {label: '25-30 mins', value: '25-30'},
    {label: '30-35 mins', value: '30-35'},
    {label: '35-40 mins', value: '35-40'},
    {label: '40-45 mins', value: '40-45'},
    {label: '45-50 mins', value: '45-50'},
    {label: '50-55 mins', value: '50-55'},
    {label: '55-60 mins', value: '55-60'}
]

function SelectDuration(){
    const { duration, setDuration } = useNewProjectStore()
    return (
        <DropMenuSettings options={durations} onSelect={(val) => setDuration(val)}>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-white/10">
                <Clock className="size-4" />
                <div className="text-sm font-medium">{duration} mins</div>
                <ChevronDown className="size-4" />
            </div>
        </DropMenuSettings>
    )
}

const attachments: DropMenuOption[] = [
    {label: 'Document', value: 'document'},
    {label: 'YouTube link', value: 'youtube-link'},
    {label: 'Image', value: 'image'},
    {label: 'Video', value: 'video'},
    {label: 'Audio', value: 'audio'},
]

const AddAttachment = () => {
    return (
        <DropMenuSettings options={attachments} onSelect={() => {}}>
            <Button variant="outline" size="icon" className="size-8 dark:bg-white/10 rounded-full">
                <IconPlus className="size-4" />
            </Button>
        </DropMenuSettings>

    )
}


function LoaderOverlay({ isLoading }: { isLoading: boolean }) {
    if (!isLoading) return null
    return (
        <div className='flex items-center justify-center w-screen h-screen fixed inset-0 bg-background/10 backdrop-blur-xs z-50'>
            <DotsLoader />
        </div>
    )
}