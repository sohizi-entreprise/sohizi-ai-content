import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { buildOptimizeddImageUrl, imageUrlTransforms } from "@/utils/transform-url";
import { PlusCircle } from "lucide-react";
import { MediaAsset, MediaGenerationRun } from "../requests";
import { Message } from "@/features/chat";
import { MediaType } from "../types";
import { TextShimmerCss } from "@/components/ui/loaders";
import MediaLoader from "./media-loader";
import { useEffect, useState } from "react";
import { useMediaGeneratorStore } from "../store/media-generator-store";
import { useBufferChunks } from "@/features/chat/hooks/use-buffer-chunks";
import { useUpdateAssetsList } from "../query-mutations";

type GenerationType = 'image' | 'video' | 'audio';

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
  const userMsg = extractUserMessage(run.messages);
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
    <div className='flex flex-col gap-2'>
        <div className='flex items-start gap-2'>
          <div className='flex items-center gap-1'>
            {userMsg.attachments.map((attachment) => (
              <SmallAvatar key={attachment.url} attachment={attachment} />
            ))}
          </div>
          
          {/* prompt */}
          <div className="flex-1">
            <p className="line-clamp-2 text-sm text-foreground tracking-wide break-all">
              {userMsg.text}
            </p>
          </div>
        </div>

        {/* Generation */}
        {
          isRunning ? (
            <RenderAssistantMessage run={run}/>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-1">
                <RenderAssets assets={run.assets} status={run.status} />
              </div>
              <AssistantMessage messages={run.messages}/>
            </div>
          )
        }

    </div>
  )
}


const RenderAssistantMessage = ({run}: {run: MediaGenerationRun;}) => {

  const [runStatus, setRunStatus] = useState(run.status);
  const removeActiveGenerationRequest = useMediaGeneratorStore(state => state.removeActiveGenerationRequest);
  const updateAssetsList = useUpdateAssetsList(run.projectId);

  const isRunning = runStatus === 'pending' || runStatus === 'running';

  const onFinish = () =>{
    // Refresh the cash for listing 
    setRunStatus('finished')
    removeActiveGenerationRequest(run.id)
  }

  

  const url = `${import.meta.env.VITE_API_BASE_URL}/media/${run.projectId}/requests/${run.id}`
  const {messages, assets} = useBufferChunks({
    url, 
    initialMessages: [], 
    onFinish,
    onAsset: (asset) => {
      console.log('asset', asset)
      updateAssetsList([asset])
    }
  })

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1">
        <RenderAssets assets={assets} status={runStatus} />
      </div>
      <AssistantMessage messages={messages} />
      {isRunning && <TextShimmerCss text="Processing..." />}
    </div>
  )
}

function AssistantMessage({messages}: {messages: Message[]}){
  const text = extractLastMessageContent(messages)
  return (
    <p className="text-xs text-foreground tracking-wide break-all">
      {text}
    </p>
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
        <span className="text-xs tracking-wide text-foreground">No assets found</span>
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

  return (
    <div className="bg-background rounded-md overflow-hidden aspect-3/4 relative">
      <img src={url} alt="attachment" className="size-full object-contain" />
      <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 absolute inset-0 bg-black/50 flex items-end justify-end">
        <RenderReuseAsset url={url} type={type} />
      </div>
    </div>
  )
}


const SmallAvatar = (props: {attachment: Attachment}) => {
  const {attachment} = props;
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
  jobs: Record<string, string | number | boolean>
  status: 'done' | 'blocked'
  message: string
}

function extractLastMessageContent(messages: Message[]) {
  let text = ''
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue

    const lastPart = message.content[message.content.length - 1]
    if (!lastPart) return text

    switch (lastPart.type) {
      case 'text':
        text = lastPart.text;
        break;
      case 'reasoning':
        text = 'Thinking ...'
        break;
      case 'tool-call':{
        text = `Calling tool ${lastPart.toolName}...`
        const toolName = lastPart.toolName;
        if(toolName === 'submitMediaJobs'){
          const input = lastPart.input as SubmitMediaJobsInput;
          text = input.message || text;
        }
        break;
      }
    }

    return text;
  }

  return text;

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
  return 'image'
}
