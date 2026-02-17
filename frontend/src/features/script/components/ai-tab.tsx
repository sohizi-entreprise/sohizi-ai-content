import { useScriptStore } from '../store';
import { useShallow } from 'zustand/shallow';
import { Sparkles } from 'lucide-react';
import { ScriptEventLog } from '../type';

export default function AiTab() {

    const {eventLogs, isStreaming} = useScriptStore(useShallow(state => ({
        eventLogs: state.eventLogs,
        isStreaming: state.isStreaming,
    })))

    if(!eventLogs.length) {
        return (
            <div className='w-full font-geist flex flex-col items-center justify-center py-12 text-center'>
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                    <Sparkles className="size-12 text-zinc-600" />
                    <p className="text-sm">No context selected</p>
                    <p className="text-xs text-zinc-600 max-w-[280px]">
                        Select blocks or add snippets from the script to start editing with AI
                    </p>
                </div>
            </div>
        );
    }

  return (
    <div className='flex flex-col gap-2'>
        {
            eventLogs.map((eventLog) => (
                <RenderEventLog key={eventLog.runId} eventLog={eventLog.data} />
            ))
        }
        {
            isStreaming && (
                <div>
                    <p>Streaming...</p>
                </div>
            )
        }

    </div>
  )
}

function RenderEventLog({eventLog}: {eventLog: Partial<ScriptEventLog> | ScriptEventLog}) {
    switch(eventLog.outputType){
        case 'response':
            return (
                <div>
                    <p>==== Response =====</p>
                    <p>{eventLog.content}</p>
                </div>
            )
        case 'thought':
            return (
                <div>
                    <p>==== Thought =====</p>
                    <p>{eventLog.content}</p>
                </div>
            )
        case 'action':
            return (
                <div>
                    <p>==== Action =====</p>
                    <p>{eventLog.statusUpdate}</p>
                    <p>{JSON.stringify(eventLog.toolCalls, null, 2)}</p>
                </div>
            )
        case 'pause':
            return (
                <div>
                    <p>==== Pause =====</p>
                    <p>{eventLog.statusUpdate}</p>
                    <p>{JSON.stringify(eventLog.toolCalls, null, 2)}</p>
                </div>
            )
        default:
            return null
    }

}
