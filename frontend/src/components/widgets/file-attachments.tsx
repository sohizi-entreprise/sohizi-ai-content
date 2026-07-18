import { useFileUpload } from '@/hooks/use-file-upload'
import { useSaveFileBucket } from '@/hooks/use-save-file-bucket'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import { FocusEvent, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export type AttachedFile = {
    status: 'pending'
    id: string
    type: string
    preview?: string
  } | {
    status: 'uploaded'
    id: string
    type: string
    preview?: string
    url: string
  } | {
    status: 'failed'
    id: string
    type: string
    preview?: string
    error: string
  }

type Props = {
    projectId: string
    attachments: Array<AttachedFile>
    onAdd: (attachment: AttachedFile) => void
    onRemove: (id: string) => void
    folderId?: string
    maxAttachments?: number
    itemSize?: number
    collapsedOffset?: number
    expandedGap?: number
    accept?: string
}

export default function FileAttachment(props: Props) {

    const { attachments, 
            projectId,
            onAdd, 
            onRemove, 
            folderId=null,
            maxAttachments = 5, 
            itemSize = 60,
            collapsedOffset = 12,
            expandedGap = 8,
            accept = 'image/*,video/*,audio/*,application/pdf,text/plain'
        } = props

    const [isExpanded, setIsExpanded] = useState(false)

    const { getInputProps, openFileDialog } = useHandleUploadedFiles({
        projectId,
        folderId,
        accept,
        maxFiles: maxAttachments,
        onAdd,
        onRemove,
    })

    const visibleAttachments = attachments.slice(0, maxAttachments)

    const expandedStep = itemSize + expandedGap
    const addButtonIndex = visibleAttachments.length
    const canAdd = attachments.length < maxAttachments
    const collapsedWidth =
      visibleAttachments.length > 0
        ? itemSize + (visibleAttachments.length - 1) * collapsedOffset
        : itemSize
    const expandedWidth =
      (visibleAttachments.length + 1) * expandedStep - expandedGap
  
    useEffect(() => {
      setIsExpanded(false)
    }, [attachments.length])
  
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsExpanded(false)
      }
    }
  
    return (
      <div
        className={cn(
          'group relative shrink-0 overflow-visible py-1 transition-[z-index] duration-300',
          isExpanded ? 'z-20' : 'z-1',
        )}
        style={{ width: collapsedWidth, height: itemSize + 8 }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onFocus={() => setIsExpanded(true)}
        onBlur={handleBlur}
      >
        <div
          className="relative"
          style={{
            width: isExpanded ? expandedWidth : collapsedWidth,
            height: itemSize,
            minWidth: itemSize,
          }}
        >
          {visibleAttachments.map((attachment, index) => {
            const collapsedX = index * collapsedOffset
            const expandedX = index * expandedStep
            const rotation = index * 5
  
            return (
              <div
                key={attachment.id}
                className="absolute left-0 top-0 overflow-hidden rounded-xl border border-white/10 bg-white/8 shadow-lg shadow-black/20 transition-[transform,border-color,box-shadow] duration-300 ease-out will-change-transform hover:border-white/25 hover:shadow-xl hover:shadow-black/30"
                style={{
                  width: itemSize,
                  height: itemSize,
                  zIndex: isExpanded
                    ? index + 1
                    : visibleAttachments.length + index,
                  transform: isExpanded
                    ? `translateX(${expandedX}px) rotate(0deg) scale(1)`
                    : `translateX(${collapsedX}px) rotate(${rotation}deg) scale(1)`,
                }}
              >
                <RenderPreview file={attachment} />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  className={cn(
                    'absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/75 text-white shadow-sm shadow-black/30 transition-[opacity,transform,background-color] duration-200 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                    isExpanded
                      ? 'scale-100 opacity-100'
                      : 'pointer-events-none scale-75 opacity-0',
                  )}
                  aria-label="Remove file"
                >
                  <X className="size-3" />
                </button>
              </div>
            )
          })}
  
          <button
            type="button"
            onClick={openFileDialog}
            disabled={!canAdd}
            className={cn(
              'absolute left-0 top-0 flex items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/6 backdrop-blur-sm text-zinc-300 transition-[transform,opacity,border-color,background-color,color] duration-300 ease-out will-change-transform hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50',
              isExpanded || visibleAttachments.length === 0
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0',
            )}
            style={{
              width: itemSize,
              height: itemSize,
              zIndex: visibleAttachments.length + 2,
              transform:
                isExpanded || visibleAttachments.length === 0
                  ? `translateX(${addButtonIndex * expandedStep}px) scale(1)`
                  : `translateX(${Math.max(addButtonIndex - 1, 0) * collapsedOffset}px) scale(0.85)`,
            }}
            aria-label="Add reference image"
          >
            <Plus className="size-5" />
          </button>
          <input {...getInputProps()} className='sr-only'/>
        </div>
      </div>
    )
}

type HandleProps = {
    folderId: string | null
    projectId: string
    accept: string
    maxFiles: number
    onAdd: (attachment: AttachedFile) => void
    onRemove: (id: string) => void
}

function useHandleUploadedFiles(props: HandleProps) {
    const { projectId, folderId, accept, maxFiles, onAdd, onRemove } = props
    const { saveFile } = useSaveFileBucket()
    
      const [
          _state,
          {
              openFileDialog,
              getInputProps,
              removeFile
          }
      ] = useFileUpload({
          multiple: true,
          accept,
          maxSize: 5 * 1024 * 1024, // 5MB
          maxFiles,
          onFilesAdded: async (data) => {
            const promises = data.map(async(file)=> {
                onAdd({
                    id: file.id,
                    preview: file.preview,
                    status: 'pending',
                    type: file.file.type,
                })
                saveFile({projectId, folderId, file: file.file as File}, {
                    onSuccess: (result) => {
                      onAdd({
                            id: file.id,
                            status: 'uploaded',
                            type: result.asset.type,
                            preview: file.preview,
                            url: result.asset.url,
                        })
                    },
                    onError: (error) => {
                      removeFile(file.id)
                      onRemove(file.id)
                      toast.error(error.message)
                    }
                })
                return 1

            })
            await Promise.all(promises)
          },
          onError: (error) => {
              toast.error(error)
          },
      })
  
    const onRemoveFile = useCallback((id: string) => {
        onRemove(id)
        removeFile(id)
      }, [onRemove, removeFile])
  
    return {
      getInputProps,
      onRemoveFile,
      openFileDialog
    }
  }


  const RenderPreview = ({file}: {file: AttachedFile}) => {
    switch (true) {
        case file.type.startsWith('image/') || file.type === 'image':
            return <img src={file.preview || (file.status === 'uploaded' && file.url) || ''} 
                            alt={file.id} 
                            className='w-full h-full object-cover'
                    />

        default:
            return (
                <div className='w-full h-full flex text-foreground items-center justify-center bg-black border'>
                    <span>
                        K{file.type.split('/')[1]?.toUpperCase()}
                    </span>
                </div>
            )
    }
}