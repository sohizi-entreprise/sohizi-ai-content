import { cn } from '@/lib/utils'
import MediaChatCard, { Message } from './media-chat-card'


type MediaChatListProps = {
  className?: string
}

const DUMMY_CHAT_GROUPS: Array<Message[]> = [
  [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'change the shirt color to red',
        },
      ],
      
    },
    {
      role: 'generation',
      status: 'pending',
      requestPayload: {},
      variantCount: 1,
      responsePayload: null,
      error: null,
    },
  ],
  [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Itaque dolor optio fugit. Ut nihil earum nemo, ratione deleniti explicabo sed nisi! Deserunt veritatis incidunt, delectus aut similique ex culpa eaque?',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/0fd07660-5292-41ec-a510-8a1260cfee0c/driv-back.jpg',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/30b43f38-cf94-4aa6-9d26-fbe1bb2c9d30/logo-black-crop-up-md.png',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/e0dc49f8-7a42-461d-b61c-5b53f23b7534/img_20211229_130807_392.jpg',
        },
      ],
    },
    {
      role: 'generation',
      status: 'completed',
      requestPayload: {},
      variantCount: 3,
      responsePayload: [
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/30b43f38-cf94-4aa6-9d26-fbe1bb2c9d30/logo-black-crop-up-md.png',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/cb647f59-e06f-4485-a59e-564147b30aba/comedy.png',
        },
      ],
      error: null,
    },
  ],
  [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'change the shirt color to red',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/cb647f59-e06f-4485-a59e-564147b30aba/comedy.png',
        },
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/e0dc49f8-7a42-461d-b61c-5b53f23b7534/img_20211229_130807_392.jpg',
        },
      ],
      
    },
    {
      role: 'generation',
      status: 'completed',
      requestPayload: {},
      variantCount: 1,
      responsePayload: [
        {
          type: 'image',
          url: 'https://media-dev.sohizi.com/images/cb647f59-e06f-4485-a59e-564147b30aba/comedy.png',
        },
      ],
      error: null,
    },
  ],
  
]

export function MediaChatList({ className }: MediaChatListProps) {
  return (
    <div
      className={cn(
        'relative flex-1 overflow-y-auto space-y-14 p-4',
        className,
      )}
    >
      {
        DUMMY_CHAT_GROUPS.map((group, ind) => (
          <MediaChatCard key={ind} messages={group}/>
        ))
      }
    </div>
  )
}

