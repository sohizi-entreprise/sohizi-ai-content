import { useCallback } from 'react'
import { IconArrowNarrowUp, IconLoader2, IconPlus } from '@tabler/icons-react'
import { Mention, MentionsInput } from 'react-mentions-ts'
import { toast } from 'sonner'
import { useSendMessage } from '../hooks/use-chat'
import { useChatStore } from '../store/chat-store'
import ChatSelectModel from './chat-select-model'
import { ContextWindowDonut } from './context-window-donut'
import type { ChatCompletionRequest } from '../types'
import type { MentionSearchContext } from 'react-mentions-ts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useEditorInputBridge } from '@/features/editor/bridge/use-editor-input-bridge'
import { MediaSettingsButton } from '@/features/media-generator'
import ChatFilesPreview from './chat-files-preview'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useSaveFileBucket } from '@/hooks/use-save-file-bucket'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { useFileMentionSearch } from '@/hooks/use-file-mention-search'

export type sendParams = {
  prompt: string
  context: {
    blocks: Array<string>
    selections: Array<string>
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
  const isStreaming = useChatStore((state) => state.isStreaming)
  const conversation = useChatStore((state) => state.activeConversation)
  const model = useChatStore((state) => state.model)
  const setInput = useEditorInputBridge((state) => state.setInput)

  const sendMessage = useSendMessage(projectId)
  const searchFiles = useFileMentionSearch(projectId)

  const { getInputProps, onRemoveFile, openFileDialog } = useHandleUploadedFiles({projectId})

  const conversationId = conversation?.id ?? null
  const modelId = model?.id

  const disableSendButton = !inputContent.trim() || isStreaming

  // Send message
  const handleSend = async () => {
    const content = inputContent.trim()
    if (disableSendButton) return

    if (!modelId) {
      toast.error('Please select a model')
      return
    }

    const payload: ChatCompletionRequest = {
      userPrompt: content,
      conversationId,
      modelId,
    }

    // Send request
    await sendMessage(payload)
  }

  // Handle keyboard events
  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await handleSend()
    }
  }

  // Handle input change and detect removed selections
  const handleInputChange = useCallback(
    ({ value: nextValue }: { value: string }) => {
      setInputContent(nextValue)
    },
    [setInputContent],
  )

  const searchFileMentions = useCallback(
    async (query: string, { signal }: MentionSearchContext) => {
      return searchFiles(query, { signal })
    },
    [searchFiles],
  )

  return (
    <div className='m-4'>

      {/* Chat input */}
      <div
        className={cn(
          'border bg-white/5 p-2 rounded-xl overflow-hidden',
          className,
        )}
      >
        <ChatFilesPreview className='mb-2' onRemoveFile={onRemoveFile} />
        <MentionsInput
          value={inputContent}
          onMentionsChange={handleInputChange}
          suggestionsPlacement="above"
          inputRef={setInput}
          autoResize
          classNames={{
            input: 'bg-transparent! max-h-50 text-sm',
            control: 'bg-transparent! border-none',
            highlighterSubstring: '',
            highlighter: 'text-green-500',
          }}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
        >
          <Mention
            trigger="@"
            data={searchFileMentions}
            debounceMs={200}
            maxSuggestions={15}
            className="bg-primary/20 rounded-none"
            displayTransform={(_, display) => ` @${display} `}
          />
          <Mention trigger="#" data={[]} />
          <Mention trigger="&&" data={[]} />
        </MentionsInput>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" 
                    size="icon" 
                    className="size-7 rounded-full border-white/10!"
                    onClick={openFileDialog}
                    disabled={isStreaming}
                    aria-label="Upload file"
            >
                <IconPlus className="size-4" />
            </Button>
            <input {...getInputProps()} className='sr-only'/>
            <MediaSettingsButton />
          </div>

          <div className="flex items-center justify-end gap-2">

            <div className="flex items-center">
              <ContextWindowDonut usage={{ percentage: 40 }} size="xs" />
              <ChatSelectModel projectId={projectId} />
            </div>


            {/* Send button */}
            <Button
              variant="default"
              onClick={handleSend}
              disabled={disableSendButton}
              className="size-6 rounded-full disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {isStreaming ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconArrowNarrowUp className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function useHandleUploadedFiles({projectId}: {projectId: string}) {
  const addAttachedFile = useChatStore(s => s.addAttachedFile)
  const updateAttachedFile = useChatStore(s => s.updateAttachedFile)
  const removeAttachedFile = useChatStore(s => s.removeAttachedFile)
  const insertNodeAt = useFileTreeStore(s => s.insertNodeAt)
  const { saveFile } = useSaveFileBucket()

  const DUMMY_FOLDER_ID = 'd77b6506-ae24-4f8a-8a2e-431a0a84cf4b'

    const [
        _state,
        {
            openFileDialog,
            getInputProps,
            removeFile
        }
    ] = useFileUpload({
        multiple: true,
        accept: 'image/*,video/*,audio/*,application/pdf,text/plain',
        maxSize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
        onFilesAdded: async (data) => {
            for (const file of data) {
                addAttachedFile({
                    id: file.id,
                    preview: file.preview,
                    status: 'pending',
                    type: file.file.type,
                })

                saveFile({projectId, folderId: DUMMY_FOLDER_ID, file: file.file as File}, {
                    onSuccess: (result) => {
                        updateAttachedFile(file.id, {
                            status: 'uploaded',
                            type: file.file.type,
                            preview: file.preview,
                            url: file.preview ?? result.storageKey,
                        })
                        insertNodeAt(DUMMY_FOLDER_ID, result.fileNode)
                    },
                    onError: (error) => {
                      removeFile(file.id)
                      removeAttachedFile(file.id)
                      toast.error(error.message)
                    }
                })
            }
        },
        onError: (error) => {
            toast.error(error)
        },
    })

  const onRemoveFile = useCallback((id: string) => {
      removeAttachedFile(id)
      removeFile(id)
    }, [removeAttachedFile, removeFile])

  return {
    getInputProps,
    onRemoveFile,
    openFileDialog
  }
}
