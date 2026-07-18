import { useEffect, useState } from 'react';
import { useBufferChunks } from '../hooks/use-buffer-chunks';
import { AgentRunBlock, FilePendingOperation, Message } from '../types'
import ChatBuble from './chat-buble';
import { TextShimmerCss } from '@/components/ui/loaders';
import { useChatStore } from '../store/chat-store';
import { fileTreeKey } from '@/features/projects/query-mutation';
import { useQueryClient } from '@tanstack/react-query';
import { getFilePendingKey } from '@/features/editor/query-mutations';

export const ChatRunBlock = ({ run }: { run: AgentRunBlock }) => {
    const status = run.status
    const messages = run.messages || [];

    const patchConversation = useChatStore((state) => state.patchActiveConversation)

    useEffect(()=>{
        if(status === 'finished' || status === 'error'){
            patchConversation({ isStreaming: false })
        }else{
            patchConversation({ isStreaming: true })
        }
    }, [status])

    if(status === 'pending' || status === 'running'){
        return <PendingRunBlock run={run} /> 
    }
    

    return <RenderMessages messages={messages} />
}

function PendingRunBlock({ run }: { run: AgentRunBlock }){
    const queryClient = useQueryClient()
    const [isFinished, setIsFinished] = useState(false)
    const onFinish = (_: AgentRunBlock['status']) => {
        setIsFinished(true)
    }
    const onOperation = (operation: FilePendingOperation) => {
        const fileId = operation.fileId
        console.log('operation', operation)
        switch(operation.type){
            case 'patch':{
                queryClient.invalidateQueries({ queryKey: getFilePendingKey(run.projectId, fileId) })
                break;
            }
            case 'refresh':{
                queryClient.invalidateQueries({ queryKey: fileTreeKey(run.projectId, fileId) })
                break;
            }
        }
    }

    const url = `${import.meta.env.VITE_API_BASE_URL}/chats/${run.projectId}/conversations/${run.conversationId}/runs/${run.id}`
    const {messages} = useBufferChunks({url, initialMessages: run.messages, onFinish, onOperation})
    
    return (
        <div className='space-y-2'>
            <RenderMessages messages={messages} />
            {!isFinished && <TextShimmerCss text="Processing..." />}
        </div>

    ) 
}


function RenderMessages({ messages }: { messages: Message[] }){
    return (
        <div className="flex flex-col gap-4">
            {messages.map((msg) => (
            <ChatBuble key={msg.id} data={msg} />
            ))}
        </div>
    )
}
