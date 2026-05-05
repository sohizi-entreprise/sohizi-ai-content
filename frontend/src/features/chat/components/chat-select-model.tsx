import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useChatStore } from "../store/chat-store"
import { listModelsQueryOptions } from "../query-mutation"
import { useQuery } from "@tanstack/react-query"
import { Spinner } from "@/components/ui/spinner"
import { Check, ChevronDown } from "lucide-react"
import { LlmModel } from "../types"
import { useEffect } from "react"

export default function ChatSelectModel({projectId}: {projectId: string}) {

    const model = useChatStore(state => state.model)
    const setModel = useChatStore(state => state.setModel)
    const {data: models = [], isLoading} = useQuery(listModelsQueryOptions(projectId))

    const onSelect = (mod: LlmModel) => {
        setModel(mod)
    }

    const isNotSet = model === null
    const isEmpty = models.length === 0

    useEffect(() => {
        if(isNotSet && !isEmpty){
            setModel(models[0])
        }
    }, [isNotSet, isEmpty, setModel])

    if(isLoading){
        return <LoadingModel />
    }


  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isLoading}>
            <button className="flex items-center gap-2 py-2 px-2 text-sm">
                {model?.name ?? 'Select Model'}
                <ChevronDown className="size-4" />
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={'center'} 
                             className="w-56 border-white/10 bg-black/90 backdrop-blur-xl"
        >
            {models.map((mod) => (
                <DropdownMenuItem key={mod.id} onClick={() => onSelect(mod)}>
                    <div className="flex items-center gap-2 text-sm">
                        {mod.name}
                        {
                            mod.id === model?.id ? (
                                <Check className="size-4" />
                            ) : null
                        }
                    </div>
                </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoadingModel(){
    return (
        <div className="flex items-center gap-2 py-2 px-4 rounded-lg dark:bg-white/10">
            <Spinner className="size-4 animate-spin" />
        </div>
    )

}
