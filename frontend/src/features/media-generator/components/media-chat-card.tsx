import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils";
import { buildOptimizeddImageUrl, imageUrlTransforms } from "@/utils/transform-url";
import { PlusCircle } from "lucide-react";

type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
type GenerationType = 'image' | 'video' | 'audio';

type Attachment = {
  type: GenerationType;
  url: string;
}

type UserMsg = {
  role: 'user';
  content: ({type: 'text'; text: string} | Attachment)[];
}

type AssistantContent = {type: 'text'; text: string} | {type: 'reasoning'; text: string};

type AssistantMsg = {
  role: 'assistant';
  content: AssistantContent[];
}

type GenerationMsg = {
  role: 'generation';
  status: GenerationStatus;
  requestPayload: Record<string, unknown>;
  variantCount: number;
  responsePayload: {type: GenerationType; url: string}[] | null;
  error: string | null;
}

export type Message = UserMsg | AssistantMsg | GenerationMsg;

type Props = {
  messages: Message[];

}

export default function MediaChatCard(props: Props) {
  const {messages} = props;
  const {prompt, attachments} = extractUserMessage(messages);
  const generationMessage = messages.find((message) => message.role === 'generation');
  // const assistantMessage = extractAssistantMessage(messages);

  return (
    <div className='flex flex-col gap-2'>
        <div className='flex items-start gap-2'>
          <div className='flex items-center gap-1'>
            {attachments.map((attachment) => (
              <SmallAvatar key={attachment.url} attachment={attachment} />
            ))}
          </div>
          
          {/* prompt */}
          <div className="flex-1">
            <p className="line-clamp-2 text-xs text-foreground tracking-wide break-all">
              {prompt}
            </p>
          </div>
        </div>

        {/* Generation */}
        <div className="grid grid-cols-5 gap-1">
          <RenderGeneration msg={generationMessage} />
        </div>



    </div>
  )
}

const RenderGeneration = ({msg}: {msg: GenerationMsg | undefined}) => {
  const payload = msg?.responsePayload || [];
  const variants = msg?.variantCount || 1;

  const status = msg?.status || 'pending';

  if(status != 'completed') {
    return (
      Array.from({length: variants}).map((_, index) => (
        <GenerationCard key={index} url={''} status={status} />
      ))
    )
  }
  return (
    payload.map((attachment) => (
      <GenerationCard key={attachment.url} url={attachment.url} type={attachment.type} status={status} />
    ))
  )
}

const GenerationCard = (props: {url: string; type?: GenerationType; status: GenerationStatus;}) => {

  const {url, status} = props;

  const containerClassName = "bg-back rounded-md overflow-hidden aspect-3/4"

  if(status === 'failed') {
    return (
      <div className={cn(containerClassName, "flex items-center justify-center")}>
        <span className="text-red-400 text-sm">
          Something went wrong
        </span>
      </div>
    )
  }
  if(status !== 'completed') {
    return (
      <div className={cn(containerClassName, "flex items-center justify-center bg-background")}>
        <span className="text-muted-foreground text-xs">
          {status}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-background rounded-md overflow-hidden aspect-3/4 relative">
      <img src={url} alt="attachment" className="size-full object-contain" />
      <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 absolute inset-0 bg-black/50 flex items-end justify-end">
        <Button variant="ghost" size="icon">
          <PlusCircle className="size-4 text-primary"/>
        </Button>
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
        <div className='size-6 border rounded-md overflow-hidden'>
          <img src={thumbnail} alt="thumbnail" className='size-full object-cover object-center' />
        </div>
      </HoverCardTrigger>

      <HoverCardContent className="w-32 aspect-3/4 bg-card border drop-shadow-md rounded-lg overflow-hidden p-1">
        <img src={src} alt="src" className='size-full object-contain' />
      </HoverCardContent>
    </HoverCard>
  )
}


function extractUserMessage(messages: Message[]) {
  let prompt = ''
  let attachments: Attachment[] = [];

  const userMessage = messages.find((message) => message.role === 'user');
  if(!userMessage) return { prompt, attachments };


  for (const part of userMessage.content) {
    if (part.type === 'text') {
      prompt = part.text;
    } else {
      attachments.push(part);
    }
  }

  return { prompt, attachments };
}


// function extractAssistantMessage(messages: Message[]) {
//   const assistantMessage = messages.find((message) => message.role === 'assistant');
//   if(!assistantMessage) return null;

//   let content: AssistantContent[] = [];

//   for(const part of assistantMessage.content){
//     content.push(part);
//   }

//   return { content };
// }

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
