import { useCallback } from 'react'
import { IconCaretUpFilled, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { ContextWindowDonut } from './context-window-donut'
import { MentionsInput, Mention, type MentionSearchContext } from 'react-mentions-ts'
import { ChatCompletionRequest } from '../types'
import ChatSelectModel from './chat-select-model'
import { toast } from 'sonner'
import { useSendMessage } from '../hooks/use-chat'
import { useQueryClient } from '@tanstack/react-query'
import { searchFilesByNameQueryOptions } from '../query-mutation'
import { searchFilesByName } from '../requests'
import { useEditorInputBridge } from '@/features/editor/bridge/use-editor-input-bridge'


export type sendParams = {
  prompt: string
  context: {
    blocks: string[];
    selections: string[];
  }
}

type ChatInputProps = {
  projectId: string
  placeholder?: string
  className?: string
}

export function ChatInput({
  projectId,
  placeholder = 'Ask anything... Use @ for characters, # for locations',
  className,
}: ChatInputProps) {

  // Store
  const setInputContent = useChatStore((state) => state.setUserPrompt)
  const inputContent = useChatStore((state) => state.userPrompt)
  const isStreaming = useChatStore(state => state.isStreaming)
  const conversation = useChatStore(state => state.activeConversation)
  const model = useChatStore(state => state.model)
  const setInput = useEditorInputBridge(state => state.setInput)

  const sendMessage = useSendMessage(projectId)
  const queryClient = useQueryClient()

  const conversationId = conversation?.id ?? null
  const modelId = model?.id

  const disableSendButton = !inputContent.trim() || isStreaming

  // Send message
  const handleSend = async () => {
    const content = inputContent.trim()
    if (disableSendButton) return

    if(!modelId){
      toast.error('Please select a model')
      return
    }

    const payload: ChatCompletionRequest = {
      userPrompt: content,
      conversationId,
      modelId
    }

    // Send request
    await sendMessage(payload)
  }

  // Handle keyboard events
  const handleKeyDown = async(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        await handleSend()
      }
  }

  // Handle input change and detect removed selections
  const handleInputChange = useCallback(({ value: nextValue }: { value: string }) => {
    setInputContent(nextValue)
  }, [setInputContent])

  const searchFileMentions = useCallback(async (query: string, {signal}: MentionSearchContext) => {
    const search = query.trim()

    if (!search) {
      return []
    }

    const files = await queryClient.fetchQuery({
      ...searchFilesByNameQueryOptions(projectId, search),
      queryFn: () => searchFilesByName(projectId, search, 15, { signal }),
      staleTime: 1000 * 60 * 1,
    })

    return files.map((file) => ({
      id: file.id,
      display: file.name,
    }))
  }, [projectId, queryClient])

  return (
    <div className={cn('border bg-white/5 m-4 p-2 rounded-xl overflow-hidden', className)}>
      <MentionsInput value={inputContent} 
                      onMentionsChange={handleInputChange}
                      suggestionsPlacement="above"
                      inputRef={setInput}
                      autoResize
                      classNames={{
                        input: 'bg-transparent! max-h-50 text-sm',
                        control: 'bg-transparent! border-none',
                        highlighterSubstring: '',
                        highlighter: 'text-green-500'
                      }}
                      placeholder={placeholder}
                      onKeyDown={handleKeyDown}
      >
        <Mention trigger="@" data={searchFileMentions} 
                             debounceMs={200} 
                             maxSuggestions={15}
                             className='bg-primary/20 rounded-none'
                             displayTransform={(_, display) => ` @${display} `}
                             
        />
        <Mention trigger="#" data={[]} />
        <Mention trigger="&&" data={[]}/>
      </MentionsInput>

      <div className='flex items-center justify-end gap-2 mt-2'>
        {/* Token usage donut */}
        <ContextWindowDonut usage={{percentage: 40}} size="sm" />

        <ChatSelectModel projectId={projectId} />

        
        {/* Send button */}
        <Button
          variant="default"
          onClick={handleSend}
          disabled={disableSendButton}
          className="size-6 rounded-full"
          aria-label="Send message"
        >
          {
            isStreaming ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconCaretUpFilled className="size-4" />
            )
          }
        </Button>
      </div>
      
    </div>
  )
}

// Helper to extract selection IDs from mention markup
// Matches pattern: &&[display](id)

// function extractSelectionIds(content: string): string[] {
//   const regex = /&&\[[^\]]*\]\(([^)]+)\)/g
//   const ids: string[] = []
//   let match
//   while ((match = regex.exec(content)) !== null) {
//     ids.push(match[1])
//   }
//   return ids
// }