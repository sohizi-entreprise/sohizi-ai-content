import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { buildOptimizeddImageUrl, imageUrlTransforms } from "@/utils/transform-url";
import { Code2, Copy, Eye, PlusCircle } from "lucide-react";
import { MediaAsset, MediaGenerationRun } from "../requests";
import { Message } from "@/features/chat";
import { MediaType } from "../types";
import { SphereLoader} from "@/components/ui/loaders";
import MediaLoader from "./media-loader";
import { useEffect, useState } from "react";
import { useMediaGeneratorStore } from "../store/media-generator-store";
import { useBufferChunks } from "@/features/chat/hooks/use-buffer-chunks";
import { useUpdateAssetsList } from "../query-mutations";
import { toast } from "sonner";
import { cn, timeFromNow } from "@/lib/utils";
import AudioPlayer from "./audio-player";
import { IconAlertTriangle } from "@tabler/icons-react";

type GenerationType = MediaType

type Attachment = {
  type: GenerationType;
  url: string;
}

type UserMessage = {
  text: string;
  attachments: {
    type: MediaType
    url: string
  }[]
}

type Props = {
  run: MediaGenerationRun;

}

export default function MediaChatCard(props: Props) {
  const {run} = props;
  const appendActiveGenerationRequest = useMediaGeneratorStore(state => state.appendActiveGenerationRequest);
  const removeActiveGenerationRequest = useMediaGeneratorStore(state => state.removeActiveGenerationRequest);

  const isRunning = run.status === 'pending' || run.status === 'running';

  useEffect(()=>{
    if(isRunning){
      appendActiveGenerationRequest({requestId: run.id});
    }
    
    return ()=>{
      removeActiveGenerationRequest(run.id);
    }
  }, [isRunning])

  return (
    <div className='flex flex-col gap-4'>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tracking-wide">
          {timeFromNow(run.createdAt)}
        </span>
      </div>
        <RenderUserMessage messages={run.messages} />

        {/* Generation */}
        <div className="">
          {
            isRunning ? (
              <RenderAssistantMessage run={run}/>
            ) : (
              <div className="flex flex-col gap-2">
                <AssistantMessage messages={run.messages} isLoading={false}/>
                <div className="grid grid-cols-5 gap-1 border p-2 rounded-xl">
                  <RenderAssets assets={run.assets} status={run.status} />
                </div>
              </div>
            )
          }
        </div>

    </div>
  )
}

const RenderUserMessage = ({messages}: {messages: Message[]}) => {
  const userMsg = extractUserMessage(messages);
  const handleCopy = () => {
    navigator.clipboard.writeText(userMsg.text);
    toast.success('Copied to clipboard');
  }
  return (
    <div className='flex flex-col bg-surface p-4 rounded-xl'>
      {/* prompt */}
      <div className="flex-1 flex items-start gap-2">
        <p className="line-clamp-2 text-sm text-foreground tracking-wide break-all flex-1">
          {userMsg.text}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={handleCopy} className="hover:bg-transparent! hover:text-foreground text-muted-foreground">
          <Copy />
        </Button> 
      </div>

      <div className='flex items-center gap-1'>
        {userMsg.attachments.map((attachment) => (
          <SmallAvatar key={attachment.url} attachment={attachment} />
        ))}
      </div>
    </div>

  )
}


const RenderAssistantMessage = ({run}: {run: MediaGenerationRun;}) => {

  const [runStatus, setRunStatus] = useState(run.status);
  const removeActiveGenerationRequest = useMediaGeneratorStore(state => state.removeActiveGenerationRequest);
  const updateAssetsList = useUpdateAssetsList(run.projectId);

  const isRunning = runStatus === 'pending' || runStatus === 'running';

  const onFinish = (status: MediaGenerationRun['status']) => {
    setRunStatus(status === 'error' ? 'error' : 'finished')
    removeActiveGenerationRequest(run.id)
  }

  

  const url = `${import.meta.env.VITE_API_BASE_URL}/media/${run.projectId}/requests/${run.id}`
  const {messages, assets} = useBufferChunks({
    url, 
    initialMessages: [], 
    onFinish,
    onAsset: (asset) => {
      updateAssetsList([asset])
    }
  })

  return (
    <div className="space-y-2">
      <AssistantMessage messages={messages} isLoading={isRunning} className="flex-1" />
      <div className="grid grid-cols-5 gap-1 border p-2 rounded-xl">
        <RenderAssets assets={assets} status={runStatus} />
      </div>
    </div>
  )
}

function AssistantMessage({messages, isLoading, className}: {messages: Message[]; isLoading: boolean; className?: string;}){
  const text = extractLastMessageContent(messages, isLoading)
  const input = extractSubmitMediaJobsInput(messages);

  const showViewPrompt = !isLoading && input.jobs.length > 0;
  
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-start gap-2 flex-1">
        <SphereLoader isLoading={isLoading} size={24} />
        <p className={cn("text-sm text-muted-foreground tracking-wide break-all", className)}>
          {text}
        </p>
      </div>
      {
        showViewPrompt && (
          <RenderViewPrompt input={input} />
        )
      }
    </div>
  )
}



const RenderAssets = ({assets, status}: {assets: MediaAsset[]; status: MediaGenerationRun['status']}) => {
  
  const isEmpty = assets.length === 0;
  const isLoadingState = status === 'pending' || status === 'running';

  if(isLoadingState && isEmpty){
    return <MediaLoader className="aspect-3/4" />
  }

  if(status === 'error'){
    return (
      <div className="flex items-center justify-center bg-background rounded-md p-2 aspect-3/4">
        <span className="text-xs tracking-wide text-destructive">An error occured</span>
      </div>
    )
  }

  if(isEmpty && !isLoadingState){
    return (
      <div className="flex items-center justify-center bg-background rounded-md p-2 aspect-3/4">
        <IconAlertTriangle className="size-6 text-destructive" />
      </div>
    )
  }

  return (
    <>
    {
      assets.map((asset) => (
        <GenerationCard key={asset.url} url={asset.url} type={asset.type}/>
      ))
    }
    {isLoadingState && <div className="aspect-3/4 bg-background rounded-md animate-pulse" />}
    </>
  )
}

const GenerationCard = (props: {url: string; type: GenerationType;}) => {

  const {url, type} = props;
  const containerClass = "bg-background rounded-md overflow-hidden aspect-3/4 relative"

  if(type === 'audio'){
    return (
      <div className={containerClass}>
        <AudioPlayer src={url} timeDisplay="remaining" className="size-full"/>
      </div>
    )
  }

  if(type === 'video'){
    return (
      <div className={containerClass}>
        <video src={url} controls className="size-full" />
      </div>
    )
  }

  if(type === 'html'){
    return (
      <div className={cn(containerClass, "flex flex-col items-center justify-center gap-2")}>
        <Code2 className="size-6 text-muted-foreground" />
        <span className="px-2 text-center text-xs text-muted-foreground">HTML video</span>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <img src={url} alt="attachment" className="size-full object-contain" />
      <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 absolute inset-0 bg-black/50 flex items-end justify-end">
        <RenderReuseAsset url={url} type={type} />
      </div>
    </div>
  )
}


const SmallAvatar = (props: {attachment: Attachment}) => {
  const {attachment} = props;

  if (attachment.type === 'html') {
    return (
      <div className="flex size-8 items-center justify-center rounded-md border bg-muted">
        <Code2 className="size-3.5 text-muted-foreground" />
      </div>
    )
  }

  const {avatarUrl: thumbnail, url: src} = getDisplayUrls(attachment);

  return(
    <HoverCard openDelay={10} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className='size-8 border rounded-md overflow-hidden'>
          <img src={thumbnail} alt="thumbnail" className='size-full object-cover object-center' />
        </div>
      </HoverCardTrigger>

      <HoverCardContent className="w-32 aspect-3/4 bg-card border drop-shadow-md rounded-lg overflow-hidden p-1">
        <img src={src} alt="src" className='size-full object-contain' />
        <RenderReuseAsset url={src} type={attachment.type} className="absolute bottom-1 right-1" />
      </HoverCardContent>
    </HoverCard>
  )
}

const RenderReuseAsset = ({url, type, className}: {url: string; type: GenerationType; className?: string;}) => {
  const addAttachment = useMediaGeneratorStore(state => state.addAttachment);
  const onClick = () => {
    const attachement = {
      id: crypto.randomUUID(),
      status: 'uploaded' as const,
      type,
      url: url,
    }
    addAttachment(attachement);
  }
  
  return (
    <Button variant="ghost" size="icon" onClick={onClick} className={className}>
      <PlusCircle className="size-4 text-primary"/>
    </Button>
  )
}

const RenderViewPrompt = ({input}: {input: {jobs: Record<string, string>[]; status: 'done' | 'blocked' | 'unknown'}}) => {
  const setViewRequestInput = useMediaGeneratorStore(state => state.setViewRequestInput);
  const isEmpty = Object.keys(input).length === 0;
  const onClick = () => {
    setViewRequestInput(input)
  }
  if(isEmpty){
    return null;
  }
  return (
    <div className="flex items-center justify-end">
      <Button onClick={onClick} variant="ghost" size="icon-sm" className="hover:bg-transparent! hover:text-foreground text-muted-foreground">
        <Eye className="size-4"/>
      </Button>
    </div>
  )
}


function extractUserMessage(messages: Message[]) {
  let userMsg: UserMessage = {
    text: '',
    attachments: [],
  } 

  for (const message of messages) {
    if(message.role === 'user'){
      for (const part of message.content) {
        switch (part.type) {
          case 'text':
            userMsg.text = part.text;
            break;
          case 'image':
            userMsg.attachments.push({
              type: 'image',
              url: part.image as unknown as string
            })
            break
          case 'file':
            userMsg.attachments.push({
              type: getMediaType(part.mediaType),
              url: part.data as unknown as string
            })
            break
        }
      }
    }
  }

  return userMsg;
}

type SubmitMediaJobsInput = {
  jobs: Record<string, string>[]
  status: 'done' | 'blocked'
  message: string
}

function extractLastMessageContent(messages: Message[], isLoading = false) {
  let submitMediaJobsMessage: string | undefined
  let textContent: string | undefined
  let hasStreamingReasoning = false
  let streamingToolName: string | undefined

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue

    for (const part of message.content) {
      switch (part.type) {
        case 'text':
          if (part.text) textContent = part.text
          break
        case 'reasoning':
          if (part.isStreaming) hasStreamingReasoning = true
          break
        case 'tool-call': {
          if (part.toolName === 'submitMediaJobs') {
            const input = part.input as Partial<SubmitMediaJobsInput>
            if (typeof input.message === 'string' && input.message.trim()) {
              submitMediaJobsMessage = input.message
            }
          }
          if (part.isStreaming) {
            streamingToolName = part.toolName
          }
          break
        }
      }
    }

    break
  }

  if (submitMediaJobsMessage) return submitMediaJobsMessage
  if (textContent) return textContent
  if (hasStreamingReasoning) return 'Thinking ...'
  if (streamingToolName) {
    return streamingToolName === 'submitMediaJobs'
      ? 'Preparing media jobs...'
      : `Calling tool ${streamingToolName}...`
  }
  return isLoading ? 'Processing ...' : ''
}


function getDisplayUrls(attachment: Attachment) {

  const {type, url: srcUrl} = attachment;

  let avatarUrl = '';
  let url = '';

  switch (type) {
    case 'image': {
      const thumbnailOptions = imageUrlTransforms.avatars.micro;
      const previewOptions = imageUrlTransforms.thumbnails.small;
      avatarUrl = buildOptimizeddImageUrl(srcUrl, thumbnailOptions);
      url = buildOptimizeddImageUrl(srcUrl, previewOptions)
      break
    }
    case 'video': {
      avatarUrl = srcUrl
      url = srcUrl
      break
    }
    case 'audio': {
      avatarUrl = srcUrl
      url = srcUrl
      break
    }
  }

  return { avatarUrl, url };
}

function extractSubmitMediaJobsInput(messages: Message[]): Omit<SubmitMediaJobsInput, 'message'> {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue

    for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.content[partIndex]
      if (part.type !== 'tool-call' || part.toolName !== 'submitMediaJobs') continue

      const input = part.input as Partial<SubmitMediaJobsInput>
      return {
        jobs: input.jobs || [],
        status: input.status || 'done',
      }
    }
  }

  return { jobs: [], status: 'done' }
}

function getMediaType(mediaType: string): MediaType {
  if(mediaType.startsWith('image/')){
    return 'image'
  }
  if(mediaType.startsWith('video/')){
    return 'video'
  }
  if(mediaType.startsWith('audio/')){
    return 'audio'
  }
  if(mediaType === 'text/html' || mediaType.startsWith('text/html')){
    return 'html'
  }
  return 'image'
}
