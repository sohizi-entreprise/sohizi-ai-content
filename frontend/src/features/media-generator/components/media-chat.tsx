import { MediaChatList } from './media-chat-list'
import { MediaChatInput } from './media-chat-input'

export default function MediaChat({ projectId }: { projectId: string }) {
  return (
    <div className='flex flex-col h-full'>
        <MediaChatList />
        <MediaChatInput projectId={projectId} 
                        className='mx-2 mb-2'
                        onGenerate={console.log}
        />
    </div>
  )
}
