import { Button } from "@/components/ui/button"
import { Conversation } from "../types"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetClose } from '@/components/ui/sheet'
import { IconHistory, IconLoader2, IconTrash, IconX} from '@tabler/icons-react'
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { deleteConversationMutationOptions, listConversationsQueryOptions } from "../query-mutation"
import { useState } from "react"
import { timeFromNow } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useChatStore } from "../store/chat-store"


export function ChatHistory({projectId}: {projectId: string}) {

    const {data: conversations = [], isLoading} = useInfiniteQuery(listConversationsQueryOptions(projectId))
    const [open, setOpen] = useState(false)
    const resetChatStore = useChatStore(state => state.reset)
    const setActiveConversation = useChatStore(state => state.setActiveConversation)

    const handleOnConversationChange = (conversation: Conversation) => {
        resetChatStore()
        setActiveConversation(conversation)
        setOpen(false)
    }
  
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
            <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Chat history"
            >
            <IconHistory className="size-4" />
            </Button>
        </SheetTrigger>
        <SheetContent side="right" showCloseButton={false} className="w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>Chat History</SheetTitle>
            <SheetDescription className="sr-only">
              Select a conversation to continue or start a new one
            </SheetDescription>
          </SheetHeader>
  
          <div className="p-4 overflow-y-auto overscroll-y-none">
            {
            isLoading ? (
              <ConversationLoader />
            ) : conversations.length === 0 ? (
              <ConversationEmpty />
            ) : (
              conversations.map((conv) => (
                <ConversationItem key={conv.id} conversation={conv} onSelect={handleOnConversationChange} projectId={projectId} />
              ))
            )}
          </div>
          <SheetClose asChild>
            <Button size="icon" className="size-8 rounded-full absolute top-4 -left-10" aria-label="Close">
              <IconX className="size-4" />
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    )
}

function ConversationItem({conversation, onSelect, projectId}: {conversation: Conversation; onSelect: (conversation: Conversation) => void; projectId: string}) {

    const {mutate: deleteConversation, isPending} = useMutation(deleteConversationMutationOptions(projectId))
    const activeConversationId = useChatStore(state => state.activeConversation?.id)
    const resetChatStore = useChatStore(state => state.reset)

    const handleDeleteConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        e.preventDefault()
        const confirm = window.confirm(`Are you sure you want to delete this conversation?`)
        if(confirm){
            deleteConversation(conversation.id, {
                onSuccess: () => {
                    if(activeConversationId === conversation.id){
                        resetChatStore()
                    }
                }
            })
        }
    }

    return (
        <div
          onClick={() => {
            onSelect(conversation)
          }}
          className="w-full flex items-center gap-4 px-3 py-2 rounded-md hover:bg-muted transition-colors cursor-pointer"
        >
            <div className="flex-1 min-w-0">
                <div className="truncate text-left min-w-0">
                    {conversation.title}
                </div>
                <div className="text-xs text-muted-foreground">
                    {timeFromNow(conversation.createdAt)}
                </div>
            </div>
            <Button variant="ghost" 
                    size="icon" className="size-8" 
                    aria-label="Delete"
                    onClick={handleDeleteConversation}
                    disabled={isPending}
            >
                {isPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconTrash className="size-4" />}
            </Button>
        </div>
    )
}

function ConversationLoader() {
    const items = [1,2,3,4]
    return (
        items.map((item) => (
            <Skeleton className="w-full h-4" key={item}/>
        ))
    )
}

function ConversationEmpty() {
    return (
        <div className="text-center text-muted-foreground text-sm py-8">
            No previous chats
        </div>
    )
}