import { useCallback, useEffect, useRef } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { toast } from 'sonner'
import type { Editor } from '@tiptap/core'
import { useSendMessage } from '../hooks/use-chat'
import { useChatStore } from '../store/chat-store'
import ChatSelectModel from './chat-select-model'
import { ContextWindowDonut } from './context-window-donut'
import ChatTextarea from './chat-textarea'
import { cn } from '@/lib/utils'
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { useEditorInputBridge } from '@/features/editor/bridge/use-editor-input-bridge'
import ChatFilesPreview from './chat-files-preview'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useSaveFileBucket } from '@/hooks/use-save-file-bucket'

type ChatInputProps = {
  projectId: string
  placeholder?: string
  className?: string
}

export function ChatInput({
  projectId,
  placeholder = 'Ask anything... Use @ to reference files',
  className,
}: ChatInputProps) {
  const setInputContent = useChatStore((state) => state.setUserPrompt)
  const inputContent = useChatStore((state) => state.userPrompt)
  const setChatEditor = useEditorInputBridge((state) => state.setChatEditor)

  const editorRef = useRef<Editor | null>(null)

  const { sendMessage, loadingState, disableSendButton } = useSendMessage(projectId)
  const { getInputProps, onRemoveFile, openFileDialog } = useHandleUploadedFiles({ projectId })

  const attachedFiles = useChatStore((state) => state.attachedFiles)
  const hasAttachments = attachedFiles.length > 0

  // Register the chat editor with the cross-editor bridge so document
  // selections can be inserted as references into the prompt.
  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      setChatEditor(editor)
    },
    [setChatEditor],
  )

  useEffect(() => () => setChatEditor(null), [setChatEditor])

  // Clear the editor once the store prompt is reset (e.g. after sending).
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (inputContent === '' && !editor.isEmpty) {
      editor.commands.clearContent()
    }
  }, [inputContent])

  const handleSubmit = useCallback(() => {
    sendMessage()
  }, [sendMessage])

  return (
    <div className="p-3">
      <PromptInput
        onSubmit={handleSubmit}
        className={cn(
          '[&>div]:rounded-2xl [&>div]:bg-background! focus-within:[&>div]:border-white/20',
          className,
        )}
      >
        <PromptInputBody className=''>
          {hasAttachments ? (
            <div className="w-full px-3 pt-3">
              <ChatFilesPreview onRemoveFile={onRemoveFile} />
            </div>
          ) : null}

          <div className="w-full max-h-40 min-w-0 overflow-y-auto px-3 pt-3">
            <ChatTextarea
              projectId={projectId}
              onChange={setInputContent}
              onSubmit={handleSubmit}
              onEditorReady={handleEditorReady}
              editorRef={editorRef}
              placeholder={placeholder}
              className=''
            />
          </div>
        </PromptInputBody>

        <PromptInputFooter className="border-white/5">
          <PromptInputTools>
            <PromptInputButton
              onClick={openFileDialog}
              disabled={loadingState}
              aria-label="Upload file"
              className="rounded-full"
            >
              <IconPlus className="size-4" />
            </PromptInputButton>
            <input {...getInputProps()} className="sr-only" />

            <ContextWindowDonut usage={{ percentage: 40 }} size="xs" />
            <ChatSelectModel projectId={projectId} />
          </PromptInputTools>

          <PromptInputSubmit
            status={loadingState ? 'submitted' : undefined}
            disabled={disableSendButton}
            className="rounded-full"
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

function useHandleUploadedFiles({ projectId }: { projectId: string }) {
  const addAttachedFile = useChatStore((s) => s.addAttachedFile)
  const updateAttachedFile = useChatStore((s) => s.updateAttachedFile)
  const removeAttachedFile = useChatStore((s) => s.removeAttachedFile)
  // const insertNodeAt = useFileTreeStore((s) => s.insertNodeAt)
  const { saveFile } = useSaveFileBucket()

  const [
    _state,
    {
      openFileDialog,
      getInputProps,
      removeFile,
    },
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

        saveFile({ projectId, folderId: null, file: file.file as File }, {
          onSuccess: (result) => {
            updateAttachedFile(file.id, {
              status: 'uploaded',
              type: file.file.type,
              preview: file.preview,
              url: result.asset.url,
            })
            // insertNodeAt(DUMMY_FOLDER_ID, result.fileNode)
          },
          onError: (error) => {
            removeFile(file.id)
            removeAttachedFile(file.id)
            toast.error(error.message)
          },
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
    openFileDialog,
  }
}
