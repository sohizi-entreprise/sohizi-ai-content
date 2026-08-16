import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { Sparkles } from 'lucide-react'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import FileAttachment from '@/components/widgets/file-attachments'
import ChatTextarea from '@/features/chat/components/chat-textarea'
import { useSendRequest } from '../hooks/use-send-request'
import { getPromptPlaceholder, supportsReferenceAttachments } from '../constants'

export type MediaChatInputProps = {
  projectId: string
  className?: string
}

export function MediaChatInput({
  projectId,
  className,
}: MediaChatInputProps) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const setChatInput = useMediaGeneratorStore((state) => state.setChatInput)
  const addAttachment = useMediaGeneratorStore((state) => state.addAttachment)
  const removeAttachment = useMediaGeneratorStore((state) => state.removeAttachment)
  const attachments = useMediaGeneratorStore((state) => state.attachments)
  const setPrompt = useMediaGeneratorStore((state) => state.setPrompt)
  const editorRef = useRef<Editor | null>(null)
  const showAttachments = supportsReferenceAttachments(generationType, generationSubtype)
  const { sendRequest, isPending, disableButton } = useSendRequest(projectId)

  useEffect(() => {
    if (editorRef.current) {
      setChatInput(editorRef.current)
    }
    return () => {
      setChatInput(null)
    }
  }, [editorRef.current, setChatInput])

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-background text-foreground focus-within:border-white/20',
        className,
      )}
    >
      <div className="relative z-1">
        <div className="max-h-28 min-h-20 min-w-0 overflow-y-auto px-3 pt-3">
          <ChatTextarea
            projectId={projectId}
            onChange={setPrompt}
            placeholder={getPromptPlaceholder(generationType, generationSubtype)}
            editorRef={editorRef}
          />
        </div>

        <div className="flex flex-col gap-2 p-2">
          {showAttachments ? (
            <FileAttachment
              projectId={projectId}
              attachments={attachments}
              onAdd={addAttachment}
              onRemove={removeAttachment}
              maxAttachments={5}
              itemSize={40}
            />
          ) : null}

          <Button
            disabled={disableButton}
            onClick={sendRequest}
            className={cn(
              'h-11 w-full rounded-xl text-black disabled:opacity-50',
              isPending && 'animate-pulse',
            )}
          >
            <Sparkles className="size-4" />
            {isPending ? 'Pending…' : 'Generate'}
          </Button>
        </div>
      </div>
    </section>
  )
}
