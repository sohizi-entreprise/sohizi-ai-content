import { Button } from '@/components/ui/button';
import { useScriptStore } from '../store';
import { cn } from '@/lib/utils';
import { ClassValue } from 'clsx';
import { useStreamScript } from '../hooks/use-stream-script';
import { Block } from '../type';

export default function GenerateStreamBtn({projectId, className}: {projectId: string; className?: ClassValue}) {

    const setStreaming = useScriptStore(state => state.setStreaming);
    const setStreamingStatus = useScriptStore(state => state.setStreamingStatus);
    const setPlan = useScriptStore(state => state.setScriptPlan);
    const addBlockChunk = useScriptStore(state => state.addBlockChunk);
    const setBlocks = useScriptStore(state => state.setBlocks);

    const url2 = `${import.meta.env.VITE_API_BASE_URL}/ai/script/project/${projectId}`

    const {startStream: secondStartStream, stopStream, isLoading: secondIsLoading} = useStreamScript(
        projectId, 
        url2,
        {
            onStatus: (status) => {
                setStreamingStatus(status)
            },
            onEnd: () => {
                setStreaming(false)
            },
            onStart: () => {
                setStreaming(true)
                setBlocks([])
            },
            onPlanChunk: (data) => {
                setPlan(data)
            },
            onBlockChunk: (data) => {
                addBlockChunk(data as Block)
            },
        }
    )

  return (
    <Button
        size="sm"
        className={cn("bg-linear-to-r from-emerald-500 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-lg shadow-emerald-900/30 border-0", className)}
        // onClick={() => startStream()}
        onClick={secondIsLoading? stopStream : secondStartStream}
        // disabled={isLoading}
    >
        {secondIsLoading ? 'Generating...' : 'Generate Script'}
    </Button>
  )
}
